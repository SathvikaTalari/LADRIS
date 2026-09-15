"""
LADRIS — Intervention Intelligence API (Phase 4)
=======================================================
Full implementation replacing the Phase 2 stub interventions router.

Endpoints:
  GET  /interventions/catalog                     — Full intervention catalog
  GET  /interventions/{project_id}                — Candidate interventions for project
  GET  /interventions/{project_id}/priority       — Ranked priority with score breakdown
  GET  /interventions/{project_id}/evidence       — Evidence/provenance per recommendation
  GET  /interventions/{project_id}/fields         — Eligible simulation fields
  POST /interventions/{project_id}/simulate       — Run one what-if scenario
  POST /interventions/{project_id}/compare        — Compare up to 3 scenarios

All simulation endpoints are strictly read-only.
All scenario outputs include explicit "Scenario estimate" labels.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.schemas.intervention import (
    ScenarioInput,
    CompareRequest,
)

log = logging.getLogger(__name__)

interventions_router = APIRouter(prefix="/interventions", tags=["Intervention Intelligence"])


# ─── Helper: Fetch Project ────────────────────────────────────────────────────

async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    """Fetch project by ID or raise 404."""
    from sqlalchemy import select
    try:
        pid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid project_id format: '{project_id}'.",
        )
    result = await db.execute(
        select(Project).where(Project.id == pid, Project.deleted_at.is_(None))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )
    return project


# ─── GET /catalog ─────────────────────────────────────────────────────────────

@interventions_router.get("/catalog")
async def get_intervention_catalog(
    current_user: User = Depends(get_current_user),
):
    """
    Return the full structured intervention catalog.
    Each entry includes intervention rules, evidence, provenance, and non-causal notes.
    """
    from app.services.production_intervention_service import get_intervention_catalog
    try:
        return get_intervention_catalog()
    except Exception as e:
        log.error("Catalog fetch error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load intervention catalog: {str(e)}",
        )


# ─── GET /{project_id} ────────────────────────────────────────────────────────

@interventions_router.get("/{project_id}")
async def list_interventions(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Map project risk signals to candidate interventions via the rule engine.

    Returns:
    - Candidate interventions with priority scores and score breakdowns
    - Rules that fired for this project
    - SHAP connections to model-supported risk contributors
    - Non-causal methodology note

    All recommendations are RULE-BASED DECISION-SUPPORT SUGGESTIONS —
    NOT causal predictions or legal orders.
    """
    project = await _get_project_or_404(project_id, db)
    from app.services.production_intervention_service import get_interventions_for_project
    try:
        return await get_interventions_for_project(project, db)
    except Exception as e:
        log.error("Intervention list error for %s: %s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Intervention engine error: {str(e)}",
        )


# ─── GET /{project_id}/priority ───────────────────────────────────────────────

@interventions_router.get("/{project_id}/priority")
async def get_intervention_priority(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return ranked interventions with full Decision-Support Priority Score breakdown.

    Priority Score (0–100) components:
    - Risk Severity (30%)
    - Urgency (25%)
    - Potential Scope/Impact (20%)
    - Implementation Feasibility (15%)
    - Data Confidence (10%)

    Labeled: "Decision-Support Priority Score" — NOT a causal optimization score.
    """
    project = await _get_project_or_404(project_id, db)
    from app.services.production_intervention_service import get_intervention_priority
    try:
        return await get_intervention_priority(project, db)
    except Exception as e:
        log.error("Priority score error for %s: %s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Priority scoring error: {str(e)}",
        )


# ─── GET /{project_id}/evidence ───────────────────────────────────────────────

@interventions_router.get("/{project_id}/evidence")
async def get_intervention_evidence(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return evidence and data provenance for all recommendations for this project.

    All evidence references are from official public data:
    - BhoomiRashi (MoRTH)
    - Data.gov.in delayed project records
    - MoRTH Annual Reports
    No evidence is fabricated.
    """
    project = await _get_project_or_404(project_id, db)
    from app.services.production_intervention_service import get_intervention_evidence
    try:
        return await get_intervention_evidence(project, db)
    except Exception as e:
        log.error("Evidence fetch error for %s: %s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evidence retrieval error: {str(e)}",
        )


# ─── GET /{project_id}/fields ─────────────────────────────────────────────────

@interventions_router.get("/{project_id}/fields")
async def get_eligible_simulation_fields(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return which fields can be simulated for this specific project.

    Each field shows:
    - Current value (derived from real project data)
    - Allowed range (physical bounds)
    - Population percentiles (from BhoomiRashi training data)
    - Data source
    - Whether simulation is available for this project

    Only fields that exist in the real project dataset are eligible.
    """
    project = await _get_project_or_404(project_id, db)
    from app.services.production_intervention_service import _features, _completeness, eligible_fields
    features = await _features(db, project)
    completeness_pct = _completeness(features)
    eligible = eligible_fields(features)

    return {
        "project_id": project_id,
        "eligible_fields": eligible,
        "data_completeness_pct": completeness_pct,
        "simulation_available": completeness_pct >= 50.0,
        "not_available_reason": (
            None if completeness_pct >= 50.0
            else f"Data completeness {completeness_pct:.1f}% is below minimum 50% required for simulation."
        ),
    }


# ─── POST /{project_id}/simulate ──────────────────────────────────────────────

@interventions_router.post("/{project_id}/simulate")
async def simulate_intervention_scenario(
    project_id: str,
    request: ScenarioInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run a single what-if scenario simulation.

    IMPORTANT:
    - This endpoint is READ-ONLY. No project records are modified.
    - Simulation re-runs the SAME deterministic Phase 3 risk pipeline
      with the hypothetical input values.
    - All outputs are labeled "Scenario estimate — not a causal prediction."
    - A simulation audit record is written to intervention_scenarios
      (marked 'SCENARIO — NOT ACTUAL GOVERNMENT ACTION').
    - Only eligible fields (real project dataset fields) can be simulated.
    - Non-simulatable fields (state_code, notifications, etc.) are rejected.
    """
    project = await _get_project_or_404(project_id, db)
    from app.services.production_intervention_service import simulate_scenario
    try:
        return await simulate_scenario(
            project=project,
            scenario_name=request.scenario_name,
            inputs=request.inputs,
            db=db,
            user_id=str(current_user.id),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        ) from e
    except Exception as e:
        log.error("Simulation error for %s: %s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation engine error: {str(e)}",
        )


# ─── POST /{project_id}/compare ───────────────────────────────────────────────

@interventions_router.post("/{project_id}/compare")
async def compare_intervention_scenarios(
    project_id: str,
    request: CompareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compare up to 3 what-if scenarios side by side.

    Returns a comparison table showing:
    - Current Signal vs Scenario Signal
    - Delta per stage and overall
    - Changed inputs per scenario
    - Best scenario labeled "Highest estimated decision-support benefit"

    IMPORTANT:
    - Strictly read-only — no project records are modified.
    - All outputs are "Scenario estimates — not causal predictions."
    - Best scenario is NOT guaranteed to be the best real-world intervention.
    """
    if len(request.scenarios) > 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Maximum 3 scenarios can be compared at once.",
        )

    project = await _get_project_or_404(project_id, db)
    from app.services.production_intervention_service import compare_scenarios

    scenario_list = [
        {"name": sc.scenario_name, "inputs": sc.inputs}
        for sc in request.scenarios
    ]

    try:
        return await compare_scenarios(
            project=project,
            scenario_list=scenario_list,
            db=db,
            user_id=str(current_user.id),
        )
    except Exception as e:
        log.error("Compare scenarios error for %s: %s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scenario comparison error: {str(e)}",
        )
