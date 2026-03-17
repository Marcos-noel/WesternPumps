from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_roles
from app.audit import log_audit
from app.event_stream import emit_domain_event
from app.models import Customer, Job, User
from app.notifications import dispatch_alert
from app.schemas import JobCreate, JobRead, JobUpdate


router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobRead], dependencies=[Depends(get_current_user)])
def list_jobs(db: Session = Depends(get_db)) -> list[JobRead]:
    jobs = db.scalars(select(Job).order_by(Job.created_at.desc())).all()
    return [JobRead.model_validate(j, from_attributes=True) for j in jobs]


@router.post("", response_model=JobRead, dependencies=[Depends(require_roles("lead_technician", "store_manager", "manager"))])
def create_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobRead:
    customer = db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid customer_id")

    if payload.site_latitude is None or payload.site_longitude is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job site latitude and longitude are required")

    if current_user.role == "lead_technician":
        if payload.assigned_to_user_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lead technician must assign a technician")
        assignee = db.get(User, payload.assigned_to_user_id)
        if not assignee or assignee.role not in {"technician", "staff"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lead technician can only assign technician users")
    else:
        assignee = db.get(User, payload.assigned_to_user_id) if payload.assigned_to_user_id else None
        if payload.assigned_to_user_id and not assignee:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid assigned_to_user_id")

    job = Job(**payload.model_dump(), created_by_user_id=current_user.id)
    db.add(job)
    log_audit(db, current_user, "create", "job", detail=payload.model_dump())
    db.commit()
    db.refresh(job)
    emit_domain_event(
        db,
        event_type="job.created",
        actor_user_id=current_user.id,
        payload={"job_id": job.id, "title": job.title, "status": job.status, "assigned_to_user_id": job.assigned_to_user_id},
    )
    if assignee and assignee.email:
        recipients = [assignee.email]
        if assignee.phone:
            recipients.append(assignee.phone)
        dispatch_alert(
            db,
            actor=current_user,
            event="job_assigned",
            subject=f"Job #{job.id} assigned to you",
            body=f"You have been assigned job #{job.id}: {job.title}",
            extra_recipients=recipients,
        )
    return JobRead.model_validate(job, from_attributes=True)


@router.get("/{job_id}", response_model=JobRead, dependencies=[Depends(get_current_user)])
def get_job(job_id: int, db: Session = Depends(get_db)) -> JobRead:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JobRead.model_validate(job, from_attributes=True)


@router.patch("/{job_id}", response_model=JobRead, dependencies=[Depends(require_roles("lead_technician", "store_manager", "manager"))])
def update_job(job_id: int, payload: JobUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> JobRead:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    if payload.customer_id is not None and not db.get(Customer, payload.customer_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid customer_id")
    if ("site_latitude" in payload.model_dump(exclude_unset=True)) ^ ("site_longitude" in payload.model_dump(exclude_unset=True)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide both site_latitude and site_longitude together")

    previous_assignee_id = job.assigned_to_user_id
    previous_status = (job.status or "open").lower()
    changes = payload.model_dump(exclude_unset=True)
    assignee = db.get(User, job.assigned_to_user_id) if job.assigned_to_user_id else None
    if "assigned_to_user_id" in changes:
        assigned_to_user_id = changes["assigned_to_user_id"]
        if assigned_to_user_id is not None:
            assignee = db.get(User, assigned_to_user_id)
            if not assignee:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid assigned_to_user_id")
            if current_user.role == "lead_technician" and assignee.role not in {"technician", "staff"}:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lead technician can only assign technician users")

    for k, v in changes.items():
        setattr(job, k, v)
    log_audit(db, current_user, "update", "job", entity_id=job_id, detail=changes)
    db.commit()
    db.refresh(job)
    emit_domain_event(
        db,
        event_type="job.updated",
        actor_user_id=current_user.id,
        payload={"job_id": job.id, "status": job.status, "priority": job.priority, "assigned_to_user_id": job.assigned_to_user_id},
    )
    if job.assigned_to_user_id and job.assigned_to_user_id != previous_assignee_id and assignee and assignee.email:
        recipients = [assignee.email]
        if assignee.phone:
            recipients.append(assignee.phone)
        dispatch_alert(
            db,
            actor=current_user,
            event="job_reassigned",
            subject=f"Job #{job.id} assigned to you",
            body=f"You have been assigned job #{job.id}: {job.title}",
            extra_recipients=recipients,
        )
    next_status = (job.status or "open").lower()
    if previous_status != "completed" and next_status == "completed":
        recipients: list[str] = []
        if job.created_by and job.created_by.email:
            recipients.append(job.created_by.email)
            if job.created_by.phone:
                recipients.append(job.created_by.phone)
        if assignee and assignee.email:
            recipients.append(assignee.email)
            if assignee.phone:
                recipients.append(assignee.phone)
        dispatch_alert(
            db,
            actor=current_user,
            event="job_completed",
            subject=f"Job #{job.id} completed",
            body=f"Job #{job.id} ({job.title}) was marked completed by {current_user.email}.",
            extra_recipients=recipients or None,
        )
        emit_domain_event(
            db,
            event_type="job.completed",
            actor_user_id=current_user.id,
            payload={"job_id": job.id, "status": job.status},
        )
    return JobRead.model_validate(job, from_attributes=True)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_roles("manager"))])
def delete_job(job_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> None:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    db.delete(job)
    log_audit(db, current_user, "delete", "job", entity_id=job_id)
    db.commit()
    return None
