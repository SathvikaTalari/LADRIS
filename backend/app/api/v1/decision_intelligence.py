"""
LADRIS — FastAPI Router: Decision Intelligence
Exposes 5 core decision support capabilities:
1. Land Conflict Graph (Land Blockers)
2. What-If Risk Simulator
3. Compensation-to-Possession Gap Detector
4. Administrative Dependency Graph (Process Bottlenecks)
5. Intervention Impact Tracker (Action Impact)
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.decision_intelligence import (
    DecisionIntelligenceOverview,
    LandBlockersResponse,
    PaymentPossessionGapResponse,
    ProcessBottlenecksResponse,
    ProjectInterventionCreate,
    ProjectInterventionResponse,
    ProjectSummaryHeader,
    WhatIfSimulationRequest,
    WhatIfSimulationResponse,
)
from app.services import decision_intelligence_service as dis

router = APIRouter(prefix="/decision-intelligence", tags=["Decision Intelligence"])


@router.get("/{project_id}", response_model=DecisionIntelligenceOverview)
async def get_overview(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Fetch complete Decision Intelligence bundle for a project."""
    try:
        return await dis.get_full_overview(project_id, db)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{project_id}/summary", response_model=ProjectSummaryHeader)
async def get_summary(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Fetch summary header: current risk score, level, delay, stage, and main blocker."""
    try:
        return await dis.get_summary_header(project_id, db)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{project_id}/land-blockers", response_model=LandBlockersResponse)
async def get_land_blockers(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Show the chain of land-related blockers for the project."""
    try:
        return await dis.get_land_blockers(project_id, db)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{project_id}/simulate", response_model=WhatIfSimulationResponse)
async def simulate(
    project_id: UUID,
    req: WhatIfSimulationRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Test controllable action inputs and re-predict ML risk using production LightGBM."""
    try:
        return await dis.simulate_what_if(project_id, req, db)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{project_id}/payment-possession-gap", response_model=PaymentPossessionGapResponse)
async def get_payment_possession_gap(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Compare compensation disbursed vs physical possession progress to flag abnormal disconnects."""
    try:
        return await dis.get_payment_possession_gap(project_id, db)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{project_id}/process-bottlenecks", response_model=ProcessBottlenecksResponse)
async def get_process_bottlenecks(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Administrative dependency graph showing where project is stuck and who needs to act."""
    try:
        return await dis.get_process_bottlenecks(project_id, db)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{project_id}/interventions", response_model=ProjectInterventionResponse, status_code=status.HTTP_201_CREATED)
async def record_intervention(
    project_id: UUID,
    req: ProjectInterventionCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Record an official intervention and compute before/after ML risk impact."""
    try:
        return await dis.record_intervention(project_id, req, db)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{project_id}/interventions", response_model=List[ProjectInterventionResponse])
async def get_interventions(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve history of official interventions logged for the project."""
    try:
        return await dis.get_interventions(project_id, db)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{project_id}/interventions/{intervention_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_intervention(
    project_id: UUID,
    intervention_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Delete an erroneously recorded intervention from the Action Ledger."""
    try:
        await dis.delete_intervention(project_id, intervention_id, db)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

