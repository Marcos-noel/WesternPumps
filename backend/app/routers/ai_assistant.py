from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import User


router = APIRouter(prefix="/ai", tags=["ai"])


class AIQuery(BaseModel):
    """User query for AI assistant"""
    query: str = Field(..., description="Natural language question about the system")
    context: str | None = Field(None, description="Optional context about what user is looking at")


class AIResponse(BaseModel):
    """AI assistant response"""
    answer: str
    data_sources: list[str] = Field(default_factory=list, description="What data was queried")
    confidence: float = Field(0.9, description="Confidence level 0-1")
    suggested_actions: list[str] = Field(default_factory=list, description="What the user might do next")


class SystemContext(BaseModel):
    """Complete system context for AI"""
    database_schema: dict[str, Any]
    feature_inventory: dict[str, Any]
    sample_data_counts: dict[str, int]
    user_role: str
    available_endpoints: list[str]


def _get_database_schema(db: Session) -> dict[str, Any]:
    """Extract complete database schema"""
    try:
        from app.models import (
            User, Customer, Job, Part, ItemInstance, StockTransaction,
            StockRequest, Category, Location, Supplier, PartAnalysis,
            DemandForecast, PickWave, ReturnAuthorization, InventoryMovementCost,
            CycleCount, AuditLog
        )
        
        models = [
            User, Customer, Job, Part, ItemInstance, StockTransaction,
            StockRequest, Category, Location, Supplier, PartAnalysis,
            DemandForecast, PickWave, ReturnAuthorization, InventoryMovementCost,
            CycleCount, AuditLog
        ]
        
        schema = {}
        for model in models:
            mapper = inspect(model)
            schema[model.__tablename__] = {
                "columns": {
                    col.name: {
                        "type": str(col.type),
                        "nullable": col.nullable,
                        "primary_key": col.primary_key,
                        "foreign_keys": [str(fk) for fk in col.foreign_keys],
                    }
                    for col in mapper.columns
                },
                "relationships": {
                    rel.key: {
                        "target": rel.mapper.class_.__tablename__,
                        "foreign_keys": rel.synchronize_pairs,
                    }
                    for rel in mapper.relationships
                },
            }
        
        return schema
    except Exception as e:
        return {"error": f"Schema extraction failed: {str(e)}"}


def _get_feature_inventory() -> dict[str, Any]:
    """Describe all new inventory science features"""
    return {
        "abc_analysis": {
            "table": "part_analysis",
            "description": "ABC classification of parts by annual usage value",
            "fields": [
                "part_id", "classification", "annual_usage_value",
                "economic_order_qty", "reorder_point", "stockout_risk_level"
            ],
            "usage": "Optimize inventory based on importance (A=critical, B=important, C=spare)"
        },
        "demand_forecasting": {
            "table": "demand_forecast",
            "description": "AI-predicted demand with multiple forecasting methods",
            "fields": [
                "part_id", "forecast_qty", "confidence_level",
                "forecast_method", "is_seasonality_adjusted"
            ],
            "methods": ["ROLLING_AVG", "EXPONENTIAL_SMOOTHING", "ARIMA", "MANUAL"],
            "usage": "Plan stock levels based on predicted demand"
        },
        "pick_waves": {
            "table": "pick_wave",
            "description": "Batch optimization for stock request fulfillment",
            "fields": [
                "wave_number", "status", "picked_by", "planned_completion"
            ],
            "statuses": ["OPEN", "ALLOCATED", "PICKED", "PACKED", "SHIPPED"],
            "usage": "Group multiple requests into optimized picking batches"
        },
        "rma_workflow": {
            "table": "return_authorization",
            "description": "Return Material Authorization tracking for defects/returns",
            "fields": [
                "rma_number", "item_instance_id", "return_reason",
                "status", "supplier_credit_memo_id"
            ],
            "statuses": ["OPEN", "RECEIVED", "ANALYZED", "CREDITED", "REJECTED"],
            "usage": "Manage returns and track supplier credits"
        },
        "cost_layers": {
            "table": "inventory_movement_cost",
            "description": "FIFO/LIFO cost tracking for accurate inventory valuation",
            "fields": [
                "unit_cost", "quantity_available", "quantity_consumed",
                "cost_method", "layer_date"
            ],
            "methods": ["FIFO", "LIFO", "WEIGHTED_AVG"],
            "usage": "Calculate accurate COGS and inventory valuation"
        },
        "cycle_count_analysis": {
            "table": "cycle_count",
            "description": "Enhanced cycle counting with root cause analysis",
            "fields": [
                "location_id", "variance_analysis_status",
                "root_cause", "resolution_deadline"
            ],
            "usage": "Identify discrepancies and their root causes"
        },
        "lot_and_expiry": {
            "table": "item_instance",
            "description": "Lot tracking and expiry date management",
            "fields": ["lot_code", "expiry_date"],
            "usage": "FIFO picking and compliance tracking"
        },
        "ownership_types": {
            "table": "part",
            "description": "Support for owned, consigned, and vendor-managed inventory",
            "fields": ["ownership_type"],
            "types": ["OWNED", "CONSIGNED", "VENDOR_MANAGED"],
            "usage": "Different accounting and fulfillment rules per ownership"
        }
    }


def _get_sample_counts(db: Session) -> dict[str, int]:
    """Get row counts for each table"""
    try:
        from app.models import (
            User, Customer, Job, Part, ItemInstance, StockTransaction,
            StockRequest, Category, Location, Supplier, PartAnalysis,
            DemandForecast, PickWave, ReturnAuthorization, InventoryMovementCost,
            CycleCount
        )
        
        models = [
            (User, "users"),
            (Customer, "customers"),
            (Job, "jobs"),
            (Part, "parts"),
            (ItemInstance, "item_instances"),
            (StockTransaction, "stock_transactions"),
            (StockRequest, "stock_requests"),
            (Category, "categories"),
            (Location, "locations"),
            (Supplier, "suppliers"),
            (PartAnalysis, "part_analyses"),
            (DemandForecast, "demand_forecasts"),
            (PickWave, "pick_waves"),
            (ReturnAuthorization, "rma_records"),
            (InventoryMovementCost, "cost_layers"),
            (CycleCount, "cycle_counts"),
        ]
        
        counts = {}
        for model, name in models:
            try:
                count = db.query(model).count()
                counts[name] = count
            except Exception:
                counts[name] = 0
        
        return counts
    except Exception:
        return {}


@router.get("/system-context", response_model=SystemContext)
def get_system_context(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SystemContext:
    """Get complete system context for AI assistant"""
    schema = _get_database_schema(db)
    features = _get_feature_inventory()
    counts = _get_sample_counts(db)
    
    endpoints = [
        "GET /api/parts - List inventory parts",
        "GET /api/customers - List customers",
        "GET /api/jobs - List jobs",
        "GET /api/requests - List stock requests",
        "GET /api/stock/transactions - List stock movements",
        "GET /api/inventory-science/part-analysis/{part_id} - ABC analysis",
        "GET /api/inventory-science/forecasts - Demand forecasts",
        "GET /api/inventory-science/pick-waves - Picking batches",
        "GET /api/inventory-science/returns - RMA records",
        "GET /api/inventory-science/cost-layers - Cost tracking",
    ]
    
    return SystemContext(
        database_schema=schema,
        feature_inventory=features,
        sample_data_counts=counts,
        user_role=current_user.role,
        available_endpoints=endpoints,
    )


@router.post("/query", response_model=AIResponse)
def process_ai_query(
    request: AIQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIResponse:
    """
    Process natural language query about the system.
    AI assistant reads database schema, features, and current data.
    """
    query_lower = request.query.lower()
    data_sources = []
    suggested_actions = []
    answer = ""
    
    # ABC Analysis queries
    if any(word in query_lower for word in ["abc", "important", "critical", "high value"]):
        try:
            from app.models import Part, PartAnalysis
            
            analyses = db.query(PartAnalysis).limit(10).all()
            if analyses:
                by_class = {"A": 0, "B": 0, "C": 0}
                for analysis in analyses:
                    if analysis.classification:
                        by_class[analysis.classification[0]] += 1
                
                answer = (
                    f"ABC Analysis Summary:\n"
                    f"- Critical (A): {by_class['A']} parts\n"
                    f"- Important (B): {by_class['B']} parts\n"
                    f"- Spare (C): {by_class['C']} parts\n\n"
                    f"Use ABC analysis to focus on high-value inventory first."
                )
                data_sources.append("part_analysis table")
                suggested_actions.append("View ABC dashboard to optimize stock levels")
            else:
                answer = "No ABC analyses found. Run ABC analysis on your parts first."
                suggested_actions.append("Generate ABC classifications for your parts")
        except Exception as e:
            answer = f"ABC analysis query failed: {str(e)}"
    
    # Demand forecast queries
    elif any(word in query_lower for word in ["forecast", "demand", "predict", "expected"]):
        try:
            from app.models import DemandForecast
            
            forecasts = db.query(DemandForecast).limit(5).all()
            if forecasts:
                total_forecast = sum(f.forecast_qty or 0 for f in forecasts)
                avg_confidence = sum(f.confidence_level or 0 for f in forecasts) / len(forecasts)
                
                answer = (
                    f"Demand Forecast Summary:\n"
                    f"- Total forecasted demand: {total_forecast} units\n"
                    f"- Average forecast confidence: {avg_confidence:.1%}\n"
                    f"- Forecasting methods: ROLLING_AVG, EXPONENTIAL_SMOOTHING, ARIMA, MANUAL\n\n"
                    f"Use forecasts to plan stock procurement."
                )
                data_sources.append("demand_forecast table")
                suggested_actions.append("Review forecast accuracy regularly")
            else:
                answer = "No demand forecasts exist yet. Create forecasts for key parts."
                suggested_actions.append("Generate demand forecasts for your top parts")
        except Exception as e:
            answer = f"Forecast query failed: {str(e)}"
    
    # Pick wave queries
    elif any(word in query_lower for word in ["pick", "wave", "batch", "fulfill", "ship"]):
        try:
            from app.models import PickWave
            
            waves = db.query(PickWave).limit(10).all()
            total = len(waves)
            statuses = {}
            for wave in waves:
                statuses[wave.status or "UNKNOWN"] = statuses.get(wave.status, 0) + 1
            
            answer = (
                f"Pick Wave Summary:\n"
                f"- Total waves: {total}\n"
                f"- Status breakdown: {statuses}\n"
                f"- Wave statuses: OPEN → ALLOCATED → PICKED → PACKED → SHIPPED\n\n"
                f"Waves batch requests for efficient picking and shipping."
            )
            data_sources.append("pick_wave table")
            suggested_actions.append("Review open waves and allocated items")
        except Exception as e:
            answer = f"Pick wave query failed: {str(e)}"
    
    # RMA/Returns queries
    elif any(word in query_lower for word in ["return", "rma", "defect", "credit", "reject"]):
        try:
            from app.models import ReturnAuthorization
            
            rmas = db.query(ReturnAuthorization).limit(10).all()
            total = len(rmas)
            statuses = {}
            for rma in rmas:
                statuses[rma.status or "UNKNOWN"] = statuses.get(rma.status, 0) + 1
            
            answer = (
                f"Return Authorization (RMA) Summary:\n"
                f"- Total RMAs: {total}\n"
                f"- Status breakdown: {statuses}\n"
                f"- RMA workflow: OPEN → RECEIVED → ANALYZED → CREDITED/REJECTED\n\n"
                f"Track returns and manage supplier credits."
            )
            data_sources.append("return_authorization table")
            suggested_actions.append("Review open RMAs and follow up on analysis")
        except Exception as e:
            answer = f"RMA query failed: {str(e)}"
    
    # Cost layer queries
    elif any(word in query_lower for word in ["cost", "fifo", "lifo", "valuation", "cogs"]):
        try:
            from app.models import InventoryMovementCost
            
            layers = db.query(InventoryMovementCost).limit(10).all()
            methods = {}
            for layer in layers:
                methods[layer.cost_method or "UNKNOWN"] = methods.get(layer.cost_method, 0) + 1
            
            answer = (
                f"Inventory Cost Layer Summary:\n"
                f"- Total cost layers: {len(layers)}\n"
                f"- Cost methods used: {methods}\n"
                f"- Supported methods: FIFO, LIFO, WEIGHTED_AVG\n\n"
                f"Cost layers ensure accurate COGS calculation and inventory valuation."
            )
            data_sources.append("inventory_movement_cost table")
            suggested_actions.append("Review cost layer accuracy for high-value items")
        except Exception as e:
            answer = f"Cost layer query failed: {str(e)}"
    
    # Inventory overview
    elif any(word in query_lower for word in ["inventory", "stock", "parts", "items", "overview"]):
        try:
            from app.models import Part, ItemInstance, StockTransaction
            
            parts_count = db.query(Part).count()
            items_count = db.query(ItemInstance).count()
            transactions_count = db.query(StockTransaction).count()
            
            answer = (
                f"Inventory Overview:\n"
                f"- Total unique parts: {parts_count}\n"
                f"- Total item instances: {items_count}\n"
                f"- Total stock transactions: {transactions_count}\n\n"
                f"The system tracks inventory at both part and instance level,\n"
                f"with full transaction audit trail."
            )
            data_sources.extend(["part", "item_instance", "stock_transaction"])
            suggested_actions.append("Review inventory status and locations")
        except Exception as e:
            answer = f"Inventory query failed: {str(e)}"
    
    # Default: system features
    else:
        features_list = _get_feature_inventory()
        feature_names = ", ".join(features_list.keys())
        answer = (
            f"New Inventory Science Features Available:\n\n"
            f"{feature_names}\n\n"
            f"Please ask about any of these features. For example:\n"
            f"- 'Show ABC analysis' - Critical vs important vs spare parts\n"
            f"- 'What are demand forecasts?' - Predicted demand by method\n"
            f"- 'How are pick waves used?' - Batch picking optimization\n"
            f"- 'Explain RMA process' - Returns and credits\n"
            f"- 'How does FIFO work?' - Cost layer calculation\n"
            f"- 'What is cycle counting?' - Variance analysis"
        )
        data_sources.append("feature_inventory")
        suggested_actions.append("Ask about specific features to learn more")
    
    return AIResponse(
        answer=answer,
        data_sources=data_sources,
        confidence=0.85,
        suggested_actions=suggested_actions,
    )


@router.get("/inventory-summary")
def get_inventory_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Get comprehensive inventory summary for AI context"""
    try:
        from app.models import (
            Part, ItemInstance, StockTransaction, Category, Location,
            PartAnalysis, DemandForecast, PickWave, ReturnAuthorization,
            InventoryMovementCost
        )
        
        return {
            "core_inventory": {
                "parts": db.query(Part).count(),
                "item_instances": db.query(ItemInstance).count(),
                "categories": db.query(Category).count(),
                "locations": db.query(Location).count(),
                "transactions": db.query(StockTransaction).count(),
            },
            "advanced_features": {
                "abc_analyses": db.query(PartAnalysis).count(),
                "demand_forecasts": db.query(DemandForecast).count(),
                "pick_waves": db.query(PickWave).count(),
                "rma_records": db.query(ReturnAuthorization).count(),
                "cost_layers": db.query(InventoryMovementCost).count(),
            },
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        return {"error": str(e)}
