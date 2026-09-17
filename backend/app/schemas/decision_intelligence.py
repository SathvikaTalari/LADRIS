"""
LADRIS — Pydantic Schemas: Decision Intelligence Module
Covers:
1. Summary Header
2. Land Blockers (Land Conflict Graph)
3. What-If Simulator
4. Payment vs Possession Gap Detector
5. Process Bottlenecks (Administrative Dependency Graph)
6. Action Impact Tracker (Interventions)
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ─── 1. Summary Header ────────────────────────────────────────────────────────

class ProjectSummaryHeader(BaseModel):
    project_id: str
    project_name: str
    project_code: str
    state_code: str
    risk_score: float
    risk_level: str
    predicted_delay_days: float
    predicted_delay_months: float
    current_stage: str
    main_blocker: str
    action_needed: str
    model_version: str
    predicted_at: str


# ─── 2. Land Blockers (Land Conflict Graph) ───────────────────────────────────

class ConflictNode(BaseModel):
    id: str
    label: str
    category: str  # PROJECT, PARCEL, OWNERSHIP, LEGAL, COMPENSATION, POSSESSION
    status: str    # CLEAR, WARNING, BLOCKED, PENDING
    detail: Optional[str] = None
    subtext: Optional[str] = None


class LandParcelDetail(BaseModel):
    id: Optional[str] = None
    khasra_number: Optional[str] = None
    village: Optional[str] = None
    district: Optional[str] = None
    area_ha: Optional[float] = None
    owner_count: Optional[int] = 1
    has_legal_dispute: bool = False
    is_in_possession: bool = False
    issue: Optional[str] = None


class LandBlockersResponse(BaseModel):
    title: str = "Land Blockers"
    short_text: str = "See which land issues are stopping project progress."
    has_data: bool = True
    message: Optional[str] = None
    parcels_count: int = 0
    disputed_parcels_count: int = 0
    possession_pending_count: int = 0
    blocked_stage: Optional[str] = None
    responsible_department: Optional[str] = None
    most_blocking_issue: Optional[str] = None
    risk_level: str = "LOW"
    days_pending: int = 0
    affected_downstream_stage: Optional[str] = None
    nodes: List[ConflictNode] = []
    parcel_items: List[LandParcelDetail] = []


# ─── 3. What-If Simulator ─────────────────────────────────────────────────────

class WhatIfSimulationRequest(BaseModel):
    compensation_disbursement_pct: Optional[float] = Field(None, ge=0, le=100)
    open_legal_dispute_count: Optional[int] = Field(None, ge=0)
    rehabilitation_progress_pct: Optional[float] = Field(None, ge=0, le=100)
    resettlement_site_ready: Optional[bool] = None
    stakeholder_update_count_90d: Optional[int] = Field(None, ge=0)


class WhatIfSimulationResponse(BaseModel):
    title: str = "What-If Simulator"
    short_text: str = "Test actions and see how project risk may change."
    baseline_risk_score: float
    baseline_risk_level: str
    baseline_delay_days: float
    simulated_risk_score: float
    simulated_risk_level: str
    simulated_delay_days: float
    risk_score_reduction: float
    delay_reduction_days: float
    improved: bool
    target_transition: Optional[str] = None
    minimum_practical_changes: List[str] = []
    current_inputs: Dict[str, Any] = {}
    simulated_inputs: Dict[str, Any] = {}
    simulated_stage_risks: List[Dict[str, Any]] = []
    model_version: str
    simulated_at: str


# ─── 4. Payment vs Possession Gap Detector ───────────────────────────────────

class PaymentPossessionGapResponse(BaseModel):
    title: str = "Payment vs Possession"
    short_text: str = "Find projects where payment is progressing but possession is still stuck."
    compensation_sanctioned_inr: float = 0.0
    compensation_disbursed_inr: float = 0.0
    payment_pct: float = 0.0
    total_area_ha: float = 0.0
    possessed_area_ha: float = 0.0
    possession_pct: float = 0.0
    gap_pct: float = 0.0
    has_abnormal_gap: bool = False
    severity: str = "LOW"  # LOW, MEDIUM, HIGH, CRITICAL
    likelihood_possession_delayed: float = 0.0  # 0.0 to 1.0
    status: str  # "Aligned", "Attention Needed", "Critical Disconnect", "Early Stage"
    status_level: str  # "success", "warning", "danger", "info"
    diagnostic: str
    action_needed: str


# ─── 5. Process Bottlenecks (Administrative Dependency Graph) ─────────────────

class WorkflowStage(BaseModel):
    name: str
    step_number: int
    status: str  # "COMPLETED", "IN_PROGRESS", "BLOCKED", "PENDING"
    responsible_department: str
    days_taken_or_pending: int = 0
    is_blocked_step: bool = False
    details: Optional[str] = None


class ProcessBottlenecksResponse(BaseModel):
    title: str = "Process Bottlenecks"
    short_text: str = "See where the project is stuck and who needs to act."
    blocked_at: str
    responsible_department: str
    days_pending: int = 0
    next_stages_affected: int = 0
    probability_downstream_delay: float = 0.0
    estimated_days_impact: int = 0
    later_stages_affected_list: List[str] = []
    stages: List[WorkflowStage] = []
    recommendation: str


# ─── 6. Action Impact Tracker (Interventions) ─────────────────────────────────

class ProjectInterventionCreate(BaseModel):
    intervention_type: str = Field(..., description="DISPUTE_RESOLUTION, COMPENSATION_RELEASE, APPROVAL_COMPLETION, RR_PROGRESS, POSSESSION_ACTION, OTHER")
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    action_taken_by: Optional[str] = None
    action_date: Optional[date] = None
    # Simulated parameter changes to apply for evaluating after-action ML risk:
    updated_compensation_pct: Optional[float] = Field(None, ge=0, le=100)
    resolved_disputes_count: Optional[int] = Field(None, ge=0)
    updated_rr_pct: Optional[float] = Field(None, ge=0, le=100)
    resettlement_ready: Optional[bool] = None


class ProjectInterventionResponse(BaseModel):
    id: str
    project_id: str
    intervention_type: str
    title: str
    description: Optional[str] = None
    action_taken_by: Optional[str] = None
    action_date: str
    risk_score_before: float
    risk_category_before: str
    predicted_delay_before: Optional[float] = None
    delay_days_before: Optional[float] = None
    risk_score_after: float
    risk_category_after: str
    predicted_delay_after: Optional[float] = None
    delay_days_after: Optional[float] = None
    risk_score_reduction: float
    delay_reduction_days: float
    status_improved: bool
    model_version: str
    prediction_timestamp: str
    created_at: str


# ─── 7. Combined Overview ─────────────────────────────────────────────────────

class DecisionIntelligenceOverview(BaseModel):
    summary: ProjectSummaryHeader
    land_blockers: LandBlockersResponse
    what_if_baseline: WhatIfSimulationResponse
    payment_possession_gap: PaymentPossessionGapResponse
    process_bottlenecks: ProcessBottlenecksResponse
    recent_interventions: List[ProjectInterventionResponse] = []
