from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db import get_db
from app.deps import get_current_user, require_roles
from app.models import AppSetting, User


router = APIRouter(prefix="/api/workflow", tags=["workflow"])

WORKFLOW_RULES_KEY = "workflow_rules_json"

DEFAULT_RULES: dict[str, Any] = {
    "job": {
        "part_issued": {"open": "in_progress"},
        "all_request_lines_closed": {"in_progress": "completed"},
    },
    "request": {
        "approved": {"pending": "approved"},
        "issued": {"approved": "issued"},
        "returned": {"issued": "closed"},
    },
}


class WorkflowRulesRead(BaseModel):
    rules: dict[str, Any]


class WorkflowRulesUpdate(BaseModel):
    rules: dict[str, Any] = Field(default_factory=dict)


class WorkflowEvaluatePayload(BaseModel):
    entity: str = Field(min_length=1, max_length=40)
    event: str = Field(min_length=1, max_length=80)
    current_state: str = Field(min_length=1, max_length=80)


class WorkflowEvaluateResult(BaseModel):
    next_state: str | None
    matched: bool


def _load_rules(db: Session) -> dict[str, Any]:
    row = db.scalar(select(AppSetting).where(AppSetting.key == WORKFLOW_RULES_KEY).limit(1))
    if not row or not row.value:
        return DEFAULT_RULES
    try:
        data = json.loads(row.value)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return DEFAULT_RULES


@router.get("/rules", response_model=WorkflowRulesRead, dependencies=[Depends(require_roles("admin", "manager"))])
def get_workflow_rules(db: Session = Depends(get_db)) -> WorkflowRulesRead:
    return WorkflowRulesRead(rules=_load_rules(db))


@router.put("/rules", response_model=WorkflowRulesRead, dependencies=[Depends(require_roles("admin"))])
def update_workflow_rules(
    payload: WorkflowRulesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkflowRulesRead:
    row = db.scalar(select(AppSetting).where(AppSetting.key == WORKFLOW_RULES_KEY).limit(1))
    encoded = json.dumps(payload.rules, ensure_ascii=True)
    if row is None:
        row = AppSetting(key=WORKFLOW_RULES_KEY, value=encoded, updated_by_user_id=current_user.id)
        db.add(row)
    else:
        row.value = encoded
        row.updated_by_user_id = current_user.id
    log_audit(db, current_user, action="update", entity_type="workflow_rules")
    db.commit()
    return WorkflowRulesRead(rules=payload.rules)


@router.post("/evaluate", response_model=WorkflowEvaluateResult, dependencies=[Depends(require_roles("admin", "manager", "approver"))])
def evaluate_transition(payload: WorkflowEvaluatePayload, db: Session = Depends(get_db)) -> WorkflowEvaluateResult:
    rules = _load_rules(db)
    entity_rules = rules.get(payload.entity, {}) if isinstance(rules, dict) else {}
    event_rules = entity_rules.get(payload.event, {}) if isinstance(entity_rules, dict) else {}
    next_state = event_rules.get(payload.current_state) if isinstance(event_rules, dict) else None
    return WorkflowEvaluateResult(next_state=next_state, matched=bool(next_state))
