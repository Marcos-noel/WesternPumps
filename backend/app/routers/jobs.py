from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Customer, Job, User
from app.schemas import JobCreate, JobRead, JobUpdate


router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobRead], dependencies=[Depends(get_current_user)])
def list_jobs(db: Session = Depends(get_db)) -> list[JobRead]:
    jobs = db.scalars(select(Job).order_by(Job.created_at.desc())).all()
    return [JobRead.model_validate(j, from_attributes=True) for j in jobs]


@router.post("", response_model=JobRead, dependencies=[Depends(get_current_user)])
def create_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobRead:
    customer = db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid customer_id")

    job = Job(**payload.model_dump(), created_by_user_id=current_user.id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return JobRead.model_validate(job, from_attributes=True)


@router.get("/{job_id}", response_model=JobRead, dependencies=[Depends(get_current_user)])
def get_job(job_id: int, db: Session = Depends(get_db)) -> JobRead:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JobRead.model_validate(job, from_attributes=True)


@router.patch("/{job_id}", response_model=JobRead, dependencies=[Depends(get_current_user)])
def update_job(job_id: int, payload: JobUpdate, db: Session = Depends(get_db)) -> JobRead:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    if payload.customer_id is not None and not db.get(Customer, payload.customer_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid customer_id")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(job, k, v)
    db.commit()
    db.refresh(job)
    return JobRead.model_validate(job, from_attributes=True)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_current_user)])
def delete_job(job_id: int, db: Session = Depends(get_db)) -> None:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    db.delete(job)
    db.commit()
    return None
