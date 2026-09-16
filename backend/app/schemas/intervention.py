"""
LADRIS — Intervention Schemas (Phase 4)
=============================================
Pydantic v2 schemas for all intervention API request/response contracts.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


# ─── Scenario Input ───────────────────────────────────────────────────────────

class ScenarioInput(BaseModel):
    """
    Validated scenario inputs for a single what-if simulation.
    Only eligible fields are accepted. Non-simulatable fields are rejected.
    """
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "scenario_name": "Scenario A — Compensation Improvement",
            "inputs": {
                "rehabilitation_progress_pct": 80,
                "stakeholder_update_count_90d": 12,
            },
        }
    })

    scenario_name: str = Field(default="Scenario A", max_length=100)
    inputs: Dict[str, float] = Field(
        ...,
        description=(
            "Map of simulatable field name → hypothetical value. "
            "Eligible production-model fields are returned by the fields endpoint."
        ),
    )

    @field_validator("inputs")
    @classmethod
    def validate_inputs_not_empty(cls, v: Dict[str, float]) -> Dict[str, float]:
        if not v:
            raise ValueError("At least one simulation input is required.")
        if len(v) > 10:
            raise ValueError("Maximum 10 fields can be simulated at once.")
        return v

class CompareRequest(BaseModel):
    """Request to compare up to 3 scenarios side by side."""
    scenarios: List[ScenarioInput] = Field(
        ...,
        min_length=1,
        max_length=3,
        description="Up to 3 scenarios to compare.",
    )


# ─── Score Component ──────────────────────────────────────────────────────────

class ScoreComponent(BaseModel):
    value: float
    weight: float
    weighted_contribution: float
    label: str
    description: str


# ─── Intervention Item ────────────────────────────────────────────────────────

class InterventionItem(BaseModel):
    intervention_id: str
    category: str
    stage: str
    display_name: str
    action_description: str
    urgency: float
    confidence: str  # HIGH / MEDIUM / LOW
    evidence: str
    provenance: str
    non_causal_note: str
    priority_score: int  # 0–100
    priority_label: str
    priority_score_label: str = "Decision-Support Priority Score"
    score_components: Dict[str, Any]
    stage_risk: float
    triggering_rules: List[str]
    risk_drivers: List[str]
    model_supported_contributors: List[Dict[str, Any]]
    recommendation_type: str = "RULE_BASED"
    output_label: str = "Rule-based recommendation"


# ─── Intervention List Response ───────────────────────────────────────────────

class InterventionListResponse(BaseModel):
    project_id: str
    status: str
    candidate_interventions: List[InterventionItem]
    top_intervention: Optional[InterventionItem] = None
    rules_fired: List[Dict[str, Any]]
    total_rules_evaluated: int
    total_interventions_matched: int
    input_signals_summary: Dict[str, Any]
    methodology_note: str
    catalog_version: str
    data_completeness_pct: float
    generated_at: str


# ─── Priority Response ────────────────────────────────────────────────────────

class PriorityResponse(BaseModel):
    project_id: str
    status: str
    ranked_interventions: List[InterventionItem]
    top_priority: Optional[InterventionItem] = None
    priority_score_label: str = "Decision-Support Priority Score"
    scoring_methodology: str
    weights: Dict[str, float]
    data_completeness_pct: float
    generated_at: str


# ─── Scenario Result ──────────────────────────────────────────────────────────

class ScenarioResult(BaseModel):
    status: str
    scenario_name: str
    scenario_method: str = "Model/Rule-Based Scenario"
    disclaimer: str
    validation_warnings: List[str] = []
    changed_inputs: List[Dict[str, Any]]
    baseline_signals: Optional[Dict[str, Any]] = None
    scenario_signals: Optional[Dict[str, Any]] = None
    delta: Optional[Dict[str, Any]] = None
    computed_at: str
    model_version: str


class SimulateResponse(BaseModel):
    project_id: str
    scenario_result: ScenarioResult
    eligible_fields: List[Dict[str, Any]]
    audit_id: Optional[str] = None  # DB record ID
    scenario_estimate_notice: str = (
        "Scenario estimate — not a causal prediction. "
        "This simulation re-runs the deterministic rule-based risk pipeline "
        "with hypothetical inputs. It does not use a supervised delay model."
    )


# ─── Compare Response ─────────────────────────────────────────────────────────

class CompareResponse(BaseModel):
    project_id: str
    status: str
    disclaimer: str
    scenario_method: str = "Model/Rule-Based Scenario"
    total_scenarios: int
    scenarios: List[ScenarioResult]
    comparison_table: List[Dict[str, Any]]
    best_scenario: Optional[str] = None
    best_scenario_note: Optional[str] = None
    computed_at: str
    scenario_estimate_notice: str = (
        "Scenario estimates — not causal predictions. "
        "Best scenario is labeled 'Highest estimated decision-support benefit' only."
    )


# ─── Catalog Response ─────────────────────────────────────────────────────────

class CatalogEntry(BaseModel):
    intervention_id: str
    category: str
    stage: str
    display_name: str
    action_description: str
    applicable_risk_factors: List[str]
    required_inputs: List[str]
    urgency: float
    implementation_feasibility: float
    affected_stage: str
    evidence: str
    provenance: str
    confidence: str
    eligibility_conditions: Dict[str, Any]
    non_causal_note: str


class CatalogResponse(BaseModel):
    catalog_version: str
    total_interventions: int
    categories: List[str]
    stages_covered: List[str]
    data_provenance: List[str]
    framework: str
    non_causal_statement: str
    interventions: List[CatalogEntry]


# ─── Evidence Response ────────────────────────────────────────────────────────

class EvidenceRecord(BaseModel):
    intervention_id: str
    category: str
    stage: str
    evidence: str
    provenance: str
    confidence: str
    data_source_url: Optional[str] = None
    applicable_risk_factors: List[str]
    non_causal_note: str


class EvidenceResponse(BaseModel):
    project_id: str
    recommendations_count: int
    evidence_records: List[EvidenceRecord]
    data_completeness_pct: float
    provenance_disclaimer: str = (
        "All evidence references are from official public data sources: "
        "BhoomiRashi (MoRTH), Data.gov.in, and MoRTH Annual Reports. "
        "No evidence is fabricated."
    )


# ─── Eligible Fields Response ─────────────────────────────────────────────────

class EligibleFieldsResponse(BaseModel):
    project_id: str
    eligible_fields: List[Dict[str, Any]]
    data_completeness_pct: float
    simulation_available: bool
    not_available_reason: Optional[str] = None
