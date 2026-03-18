"""
Enhanced Reports API - Profitability, Productivity, Valuation, and Custom Reports
"""
from datetime import datetime, date, timedelta
from typing import Optional, Any
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import (
    User, Job, Customer, Part, StockTransaction,
    Invoice, InvoiceLine, Payment, JobCosting, JobSchedule,
    BatchUsageRecord, UsageRecord, StockRequest, PurchaseOrder,
    CustomReportDefinition
)

router = APIRouter(prefix="/api/reports", tags=["Reports V2"])


# ============================================
# PROFITABILITY REPORTS
# ============================================

class JobProfitabilityResponse(BaseModel):
    job_id: int
    job_title: str
    customer_name: str
    status: str
    labor_cost: float
    parts_cost: float
    travel_cost: float
    other_cost: float
    total_cost: float
    revenue: float
    profit: float
    profit_margin: float
    completed_at: Optional[datetime]


class ProfitabilitySummaryResponse(BaseModel):
    total_revenue: float
    total_costs: float
    total_profit: float
    average_margin: float
    jobs_analyzed: int
    profitable_jobs: int
    unprofitable_jobs: int


@router.get("/profitability", response_model=ProfitabilitySummaryResponse)
def get_profitability_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get job profitability report showing revenue vs costs per job
    """
    # First get all job IDs that match the filter
    job_query = select(Job.id)
    
    filters = []
    if start_date:
        filters.append(Job.created_at >= start_date)
    if end_date:
        filters.append(Job.created_at <= end_date)
    if customer_id:
        filters.append(Job.customer_id == customer_id)

    if filters:
        job_query = job_query.where(and_(*filters))

    job_ids = db.scalars(job_query).all()
    
    # Now get all job_costing records for these jobs
    costing_query = select(JobCosting).where(JobCosting.job_id.in_(job_ids))
    costings = {c.job_id: c for c in db.scalars(costing_query).all()}
    
    # Get jobs with their basic info
    jobs = db.scalars(select(Job).where(Job.id.in_(job_ids))).all()

    total_revenue = 0
    total_costs = 0
    profitable_count = 0
    unprofitable_count = 0

    for job in jobs:
        # Get job costing from our pre-fetched dictionary
        job_costing = costings.get(job.id)
        
        # Calculate costs from job costing if exists
        labor = job_costing.labor_cost if job_costing else 0
        parts = job_costing.parts_cost if job_costing else 0
        travel = job_costing.travel_cost if job_costing else 0
        other = job_costing.other_cost if job_costing else 0
        total_cost = labor + parts + travel + other

        # Get revenue from invoices
        invoice_revenue = sum(
            inv.total_amount for inv in job.invoices if inv.status in ["PAID", "SENT", "PARTIAL"]
        ) if hasattr(job, 'invoices') else 0

        total_revenue += invoice_revenue
        total_costs += total_cost

        if invoice_revenue > total_cost:
            profitable_count += 1
        elif invoice_revenue > 0:
            unprofitable_count += 1

    total_profit = total_revenue - total_costs
    avg_margin = (total_profit / total_revenue * 100) if total_revenue > 0 else 0

    return ProfitabilitySummaryResponse(
        total_revenue=total_revenue,
        total_costs=total_costs,
        total_profit=total_profit,
        average_margin=avg_margin,
        jobs_analyzed=len(jobs),
        profitable_jobs=profitable_count,
        unprofitable_jobs=unprofitable_count,
    )


@router.get("/profitability/jobs")
def get_profitable_jobs(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    sort_by: str = "profit",
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed job profitability data"""
    query = (
        select(Job)
        .outerjoin(JobCosting, Job.id == JobCosting.job_id)
        .outerjoin(Customer, Job.customer_id == Customer.id)
    )

    filters = []
    if start_date:
        filters.append(Job.created_at >= start_date)
    if end_date:
        filters.append(Job.created_at <= end_date)

    if filters:
        query = query.where(and_(*filters))

    jobs = db.scalars(query).all()

    results = []
    for job in jobs:
        labor = job.job_costing.labor_cost if job.job_costing else 0
        parts = job.job_costing.parts_cost if job.job_costing else 0
        travel = job.job_costing.travel_cost if job.job_costing else 0
        other = job.job_costing.other_cost if job.job_costing else 0
        total_cost = labor + parts + travel + other

        revenue = sum(
            inv.total_amount for inv in job.invoices
            if inv.status in ["PAID", "SENT", "PARTIAL"]
        ) if hasattr(job, 'invoices') else 0

        profit = revenue - total_cost
        margin = (profit / revenue * 100) if revenue > 0 else 0

        results.append({
            "job_id": job.id,
            "job_title": job.title,
            "customer_name": job.customer.name if job.customer else "N/A",
            "status": job.status,
            "labor_cost": labor,
            "parts_cost": parts,
            "travel_cost": travel,
            "other_cost": other,
            "total_cost": total_cost,
            "revenue": revenue,
            "profit": profit,
            "profit_margin": margin,
        })

    # Sort results
    if sort_by == "profit":
        results.sort(key=lambda x: x["profit"], reverse=True)
    elif sort_by == "margin":
        results.sort(key=lambda x: x["profit_margin"], reverse=True)
    elif sort_by == "revenue":
        results.sort(key=lambda x: x["revenue"], reverse=True)

    return results[:limit]


@router.get("/profitability/details")
def get_profitability_details(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    sort_by: str = "profit",
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed job profitability data - alias for /profitability/jobs"""
    # First get all job IDs that match the filter
    job_query = select(Job.id)
    
    filters = []
    if start_date:
        filters.append(Job.created_at >= start_date)
    if end_date:
        filters.append(Job.created_at <= end_date)

    if filters:
        job_query = job_query.where(and_(*filters))

    job_ids = db.scalars(job_query).all()
    
    # Now get all job_costing records for these jobs
    costing_query = select(JobCosting).where(JobCosting.job_id.in_(job_ids))
    costings = {c.job_id: c for c in db.scalars(costing_query).all()}
    
    # Get jobs with their basic info
    jobs = db.scalars(select(Job).where(Job.id.in_(job_ids))).all()

    results = []
    for job in jobs:
        # Get job costing from our pre-fetched dictionary
        job_costing = costings.get(job.id)
        
        labor = job_costing.labor_cost if job_costing else 0
        parts = job_costing.parts_cost if job_costing else 0
        travel = job_costing.travel_cost if job_costing else 0
        other = job_costing.other_cost if job_costing else 0
        total_cost = labor + parts + travel + other

        revenue = 0  # Would need invoice join for actual revenue

        profit = revenue - total_cost
        margin = (profit / revenue * 100) if revenue > 0 else 0

        results.append({
            "job_id": job.id,
            "job_title": job.title,
            "customer_name": "N/A",
            "status": job.status,
            "labor_cost": labor,
            "parts_cost": parts,
            "travel_cost": travel,
            "other_cost": other,
            "total_cost": total_cost,
            "revenue": revenue,
            "profit": profit,
            "profit_margin": margin,
        })

    # Sort results
    if sort_by == "profit":
        results.sort(key=lambda x: x["profit"], reverse=True)
    elif sort_by == "margin":
        results.sort(key=lambda x: x["profit_margin"], reverse=True)
    elif sort_by == "revenue":
        results.sort(key=lambda x: x["revenue"], reverse=True)

    return results[:limit]


# ============================================
# TECHNICIAN PRODUCTIVITY REPORTS
# ============================================

class TechnicianProductivityResponse(BaseModel):
    technician_id: int
    technician_name: str
    jobs_completed: int
    jobs_in_progress: int
    total_parts_used: float
    total_labor_hours: Optional[float]
    average_job_time_hours: Optional[float]
    jobs_this_month: int
    revenue_generated: float


@router.get("/technician-productivity")
def get_technician_productivity(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get technician productivity metrics"""
    # Default to current month
    if not start_date:
        today = date.today()
        start_date = date(today.year, today.month, 1)
    if not end_date:
        end_date = date.today()

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Get all technicians
    technicians = db.query(User).filter(User.role.in_([
        "technician", "lead_technician"
    ])).all()

    results = []
    for tech in technicians:
        # Jobs completed in period
        completed_jobs = db.query(Job).filter(
            and_(
                Job.assigned_to_user_id == tech.id,
                Job.status == "completed",
                Job.updated_at >= start_dt,
                Job.updated_at <= end_dt
            )
        ).count()

        # Jobs in progress
        in_progress = db.query(Job).filter(
            and_(
                Job.assigned_to_user_id == tech.id,
                Job.status == "in_progress"
            )
        ).count()

        # Jobs this month
        month_start = date(date.today().year, date.today().month, 1)
        month_start_dt = datetime.combine(month_start, datetime.min.time())
        jobs_this_month = db.query(Job).filter(
            and_(
                Job.assigned_to_user_id == tech.id,
                Job.created_at >= month_start_dt
            )
        ).count()

        # Parts used (from batch usage records)
        parts_used = db.query(func.sum(BatchUsageRecord.quantity * BatchUsageRecord.unit_cost)).filter(
            and_(
                BatchUsageRecord.technician_id == tech.id,
                BatchUsageRecord.created_at >= start_dt,
                BatchUsageRecord.created_at <= end_dt
            )
        ).scalar() or 0

        # Revenue from jobs assigned to this technician
        revenue = db.query(func.sum(Invoice.total_amount)).join(
            Job, Invoice.job_id == Job.id
        ).filter(
            and_(
                Job.assigned_to_user_id == tech.id,
                Invoice.status.in_(["PAID", "SENT", "PARTIAL"])
            )
        ).scalar() or 0

        results.append({
            "technician_id": tech.id,
            "technician_name": tech.full_name or tech.email,
            "jobs_completed": completed_jobs,
            "jobs_in_progress": in_progress,
            "total_parts_used": float(parts_used),
            "jobs_this_month": jobs_this_month,
            "revenue_generated": float(revenue),
        })

    return results


# ============================================
# INVENTORY VALUATION REPORTS
# ============================================

class InventoryValuationResponse(BaseModel):
    total_value: float
    by_category: list[dict]
    by_location: list[dict]
    by_supplier: list[dict]
    items_count: int
    low_stock_items: int
    overstock_items: int


@router.get("/inventory-valuation", response_model=InventoryValuationResponse)
def get_inventory_valuation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get inventory valuation showing total stock value"""
    from app.models import Category, Location, Supplier

    # Total value = sum(quantity_on_hand * unit_price)
    parts = db.query(Part).filter(Part.is_active == True).all()

    total_value = 0
    items_count = 0
    low_stock_count = 0
    overstock_count = 0

    category_values: dict = {}
    location_values: dict = {}
    supplier_values: dict = {}

    for part in parts:
        value = (part.quantity_on_hand or 0) * (part.unit_price or 0)
        total_value += value
        items_count += 1

        if part.quantity_on_hand < part.min_quantity:
            low_stock_count += 1
        if part.quantity_on_hand > (part.safety_stock * 2):
            overstock_count += 1

        # By category
        if part.category:
            cat_name = part.category.name
            category_values[cat_name] = category_values.get(cat_name, 0) + value

        # By location
        if part.location:
            loc_name = part.location.name
            location_values[loc_name] = location_values.get(loc_name, 0) + value

        # By supplier
        if part.supplier:
            sup_name = part.supplier.name
            supplier_values[sup_name] = supplier_values.get(sup_name, 0) + value

    return InventoryValuationResponse(
        total_value=total_value,
        by_category=[{"category": k, "value": v} for k, v in category_values.items()],
        by_location=[{"location": k, "value": v} for k, v in location_values.items()],
        by_supplier=[{"supplier": k, "value": v} for k, v in supplier_values.items()],
        items_count=items_count,
        low_stock_items=low_stock_count,
        overstock_items=overstock_count,
    )


# ============================================
# CUSTOM REPORT BUILDER
# ============================================

class CustomReportCreate(BaseModel):
    name: str
    description: Optional[str] = None
    report_type: str
    entity_table: str
    fields_json: str
    filters_json: Optional[str] = None
    group_by: Optional[str] = None
    sort_by: Optional[str] = None
    sort_order: str = "ASC"
    is_public: bool = False


class CustomReportResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    report_type: str
    entity_table: str
    fields_json: str
    filters_json: Optional[str]
    group_by: Optional[str]
    sort_by: Optional[str]
    sort_order: str
    is_public: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/custom", response_model=CustomReportResponse)
def create_custom_report(
    report: CustomReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a custom report definition"""
    db_report = CustomReportDefinition(
        tenant_id=current_user.tenant_id,
        name=report.name,
        description=report.description,
        report_type=report.report_type,
        entity_table=report.entity_table,
        fields_json=report.fields_json,
        filters_json=report.filters_json,
        group_by=report.group_by,
        sort_by=report.sort_by,
        sort_order=report.sort_order,
        created_by_user_id=current_user.id,
        is_public=report.is_public,
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


@router.get("/custom", response_model=list[CustomReportResponse])
def list_custom_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List custom report definitions"""
    reports = db.query(CustomReportDefinition).filter(
        or_(
            CustomReportDefinition.tenant_id == current_user.tenant_id,
            CustomReportDefinition.is_public == True
        )
    ).all()
    return reports


@router.get("/custom/{report_id}")
def run_custom_report(
    report_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Execute a custom report and return results"""
    report = db.query(CustomReportDefinition).filter(
        CustomReportDefinition.id == report_id
    ).first()

    if not report:
        return {"error": "Report not found"}

    # Parse fields and build query
    try:
        fields = json.loads(report.fields_json)
    except json.JSONDecodeError:
        return {"error": "Invalid fields JSON"}

    # For now, return a placeholder - actual implementation would build dynamic queries
    return {
        "report_name": report.name,
        "report_type": report.report_type,
        "fields": fields,
        "message": "Custom report execution - to be implemented with dynamic query builder",
    }


@router.delete("/custom/{report_id}")
def delete_custom_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a custom report definition"""
    report = db.query(CustomReportDefinition).filter(
        and_(
            CustomReportDefinition.id == report_id,
            CustomReportDefinition.created_by_user_id == current_user.id
        )
    ).first()

    if not report:
        return {"error": "Report not found or not authorized"}

    db.delete(report)
    db.commit()
    return {"message": "Report deleted successfully"}


# ============================================
# SCHEDULE / CALENDAR REPORT
# ============================================

@router.get("/schedule")
def get_schedule_report(
    start_date: date,
    end_date: date,
    technician_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get job schedule/calendar data"""
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    query = select(JobSchedule).filter(
        and_(
            JobSchedule.scheduled_date >= start_date,
            JobSchedule.scheduled_date <= end_date
        )
    )

    if technician_id:
        query = query.filter(JobSchedule.assigned_technician_id == technician_id)

    schedules = db.scalars(query).all()

    results = []
    for sched in schedules:
        results.append({
            "id": sched.id,
            "job_id": sched.job_id,
            "job_title": sched.job.title if sched.job else "Unknown",
            "scheduled_date": sched.scheduled_date.isoformat(),
            "start_time": sched.start_time.isoformat() if sched.start_time else None,
            "end_time": sched.end_time.isoformat() if sched.end_time else None,
            "technician_id": sched.assigned_technician_id,
            "technician_name": sched.assigned_technician.full_name if sched.assigned_technician else "Unassigned",
            "status": sched.status,
            "is_all_day": sched.is_all_day,
        })

    return results


# ============================================
# REORDER ALERTS SUMMARY
# ============================================

@router.get("/reorder-alerts")
def get_reorder_alerts_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get summary of items that need reordering"""
    from app.models import ReorderAlert

    # Get active alerts
    alerts = db.query(ReorderAlert).filter(
        ReorderAlert.is_resolved == False
    ).all()

    # Also find parts below threshold that don't have alerts
    low_stock_parts = db.query(Part).filter(
        and_(
            Part.is_active == True,
            Part.quantity_on_hand < Part.min_quantity
        )
    ).all()

    # Build response
    results = []

    for alert in alerts:
        results.append({
            "type": "alert",
            "part_id": alert.part_id,
            "part_name": alert.part.name if alert.part else "Unknown",
            "sku": alert.part.sku if alert.part else "Unknown",
            "current_quantity": alert.current_quantity,
            "threshold": alert.threshold_quantity,
            "alert_type": alert.alert_type,
            "created_at": alert.created_at.isoformat(),
        })

    for part in low_stock_parts:
        # Check if alert already exists
        existing = next((a for a in alerts if a.part_id == part.id), None)
        if not existing:
            results.append({
                "type": "threshold",
                "part_id": part.id,
                "part_name": part.name,
                "sku": part.sku,
                "current_quantity": part.quantity_on_hand,
                "threshold": part.min_quantity,
                "alert_type": "LOW_STOCK",
                "suggested_order_qty": part.reorder_quantity or (part.min_quantity * 2 - part.quantity_on_hand),
            })

    return results


# ============================================
# STORE MANAGER REPORTS
# ============================================


class StockUsageResponse(BaseModel):
    part_id: int
    part_name: str
    sku: str
    category: Optional[str]
    total_used: int
    total_value: float
    usage_count: int


@router.get("/store-manager/stock-usage", response_model=list[StockUsageResponse])
def get_stock_usage_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get stock usage report - for Store Manager role"""
    if current_user.role not in ["store_manager", "manager", "admin", "finance"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Default to last 30 days
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = (datetime.combine(end_date, datetime.min.time()) - timedelta(days=30)).date()
    
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())
    
    # Get all stock transactions that are OUT (issued/used)
    transactions = db.query(StockTransaction).filter(
        and_(
            StockTransaction.transaction_type == "OUT",
            StockTransaction.created_at >= start_dt,
            StockTransaction.created_at <= end_dt
        )
    ).all()
    
    # Aggregate by part
    usage_data = {}
    for txn in transactions:
        if txn.part_id not in usage_data:
            usage_data[txn.part_id] = {
                "part_id": txn.part_id,
                "part_name": txn.part.name if txn.part else "Unknown",
                "sku": txn.part.sku if txn.part else "Unknown",
                "category": txn.part.category.name if txn.part and txn.part.category else "Uncategorized",
                "total_used": 0,
                "total_value": 0,
                "usage_count": 0
            }
        qty = abs(txn.quantity_change or 0)
        usage_data[txn.part_id]["total_used"] += qty
        usage_data[txn.part_id]["total_value"] += qty * (txn.part.unit_price or 0) if txn.part else 0
        usage_data[txn.part_id]["usage_count"] += 1
    
    results = list(usage_data.values())
    results.sort(key=lambda x: x["total_used"], reverse=True)
    return results[:limit]


class FrequentlyUsedItemResponse(BaseModel):
    part_id: int
    part_name: str
    sku: str
    category: str
    usage_count: int
    total_quantity: int
    average_per_use: float


@router.get("/store-manager/frequently-used", response_model=list[FrequentlyUsedItemResponse])
def get_frequently_used_items(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get most frequently used stock items - for Store Manager role"""
    if current_user.role not in ["store_manager", "manager", "admin", "finance"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = (datetime.combine(end_date, datetime.min.time()) - timedelta(days=90)).date()
    
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())
    
    # Get transaction counts by part
    from sqlalchemy import func
    
    usage_stats = db.query(
        StockTransaction.part_id,
        func.count(StockTransaction.id).label("usage_count"),
        func.sum(func.abs(StockTransaction.quantity_change)).label("total_quantity")
    ).filter(
        and_(
            StockTransaction.transaction_type == "OUT",
            StockTransaction.created_at >= start_dt,
            StockTransaction.created_at <= end_dt
        )
    ).group_by(StockTransaction.part_id).all()
    
    results = []
    for stat in usage_stats:
        part = db.get(Part, stat.part_id)
        if part:
            results.append({
                "part_id": stat.part_id,
                "part_name": part.name,
                "sku": part.sku,
                "category": part.category.name if part.category else "Uncategorized",
                "usage_count": stat.usage_count,
                "total_quantity": int(stat.total_quantity or 0),
                "average_per_use": round(float(stat.total_quantity or 0) / stat.usage_count, 2) if stat.usage_count else 0
            })
    
    results.sort(key=lambda x: x["usage_count"], reverse=True)
    return results[:limit]


class StockUsageByTechnicianResponse(BaseModel):
    technician_id: int
    technician_name: str
    total_transactions: int
    total_parts_used: int
    total_value: float
    parts_list: list[dict]


@router.get("/store-manager/usage-by-technician", response_model=list[StockUsageByTechnicianResponse])
def get_stock_usage_by_technician(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get stock usage segmented by technician - for Store Manager role"""
    if current_user.role not in ["store_manager", "manager", "admin", "finance"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = (datetime.combine(end_date, datetime.min.time()) - timedelta(days=30)).date()
    
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())
    
    # Get technicians
    technicians = db.query(User).filter(
        User.role.in_(["technician", "lead_technician"])
    ).all()
    
    results = []
    for tech in technicians:
        # Get stock transactions by this technician
        txns = db.query(StockTransaction).filter(
            and_(
                StockTransaction.performed_by_user_id == tech.id,
                StockTransaction.transaction_type == "OUT",
                StockTransaction.created_at >= start_dt,
                StockTransaction.created_at <= end_dt
            )
        ).all()
        
        total_parts = sum(abs(t.quantity_change or 0) for t in txns)
        total_value = sum(abs(t.quantity_change or 0) * (t.part.unit_price or 0) for t in txns if t.part)
        
        # Build parts list
        parts_dict = {}
        for t in txns:
            if t.part_id not in parts_dict:
                parts_dict[t.part_id] = {
                    "part_id": t.part_id,
                    "part_name": t.part.name if t.part else "Unknown",
                    "sku": t.part.sku if t.part else "Unknown",
                    "quantity": 0,
                    "value": 0
                }
            qty = abs(t.quantity_change or 0)
            parts_dict[t.part_id]["quantity"] += qty
            parts_dict[t.part_id]["value"] += qty * (t.part.unit_price or 0) if t.part else 0
        
        results.append({
            "technician_id": tech.id,
            "technician_name": tech.full_name or tech.email,
            "total_transactions": len(txns),
            "total_parts_used": total_parts,
            "total_value": round(total_value, 2),
            "parts_list": list(parts_dict.values())
        })
    
    results.sort(key=lambda x: x["total_value"], reverse=True)
    return results
