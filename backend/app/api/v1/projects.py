"""
LADRIS — Projects API Routes
GET    /api/v1/projects/          — list with filters + pagination
POST   /api/v1/projects/          — create project
GET    /api/v1/projects/{id}      — get project detail
PUT    /api/v1/projects/{id}      — update project
DELETE /api/v1/projects/{id}      — soft-delete project
"""
import math
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_officer
from app.models.project import Project, ProjectStatus, ProjectType, RiskLevel
from app.models.user import User, UserRole
from app.schemas.common import PaginatedResponse
from app.schemas.project import ProjectCreate, ProjectListResponse, ProjectResponse, ProjectUpdate
from app.services.audit_service import record_audit_log
from app.services.ml_feature_service import validate_project_consistency
from app.services.production_ml_service import latest_prediction, latest_predictions

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("/", response_model=PaginatedResponse[ProjectListResponse])
async def list_projects(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    state_code: Optional[str] = Query(None, max_length=3),
    district: Optional[str] = Query(None, max_length=100),
    agency: Optional[str] = Query(None, max_length=100),
    project_type: Optional[ProjectType] = None,
    status: Optional[ProjectStatus] = None,
    risk_level: Optional[RiskLevel] = None,
    search: Optional[str] = Query(None, max_length=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[ProjectListResponse]:
    """List projects with optional filters (status, risk level, state, district, agency) and pagination."""
    query = select(Project).where(Project.deleted_at.is_(None))

    # Apply role-based scoping automatically
    if current_user.role == UserRole.STATE_ADMIN and current_user.state_code:
        query = query.where(Project.state_code == current_user.state_code.upper())
    elif current_user.role == UserRole.DISTRICT_OFFICER and current_user.state_code:
        query = query.where(Project.state_code == current_user.state_code.upper())

    if current_user.role == UserRole.PROJECT_AGENCY and current_user.agency_name:
        query = query.where(
            (Project.executing_agency.ilike(f"%{current_user.agency_name}%")) |
            (Project.nodal_agency.ilike(f"%{current_user.agency_name}%"))
        )

    # Filter by explicitly provided query parameters
    if state_code:
        query = query.where(Project.state_code == state_code.upper())
    if district:
        query = query.where(func.array_to_string(Project.district_codes, ',').ilike(f"%{district}%"))
    if agency:
        query = query.where(
            (Project.executing_agency.ilike(f"%{agency}%")) |
            (Project.nodal_agency.ilike(f"%{agency}%"))
        )
    if project_type:
        query = query.where(Project.project_type == project_type)
    if status:
        query = query.where(Project.status == status)
    if risk_level:
        query = query.where(Project.risk_level == risk_level)
    if search:
        query = query.where(
            (Project.name.ilike(f"%{search}%")) |
            (Project.project_code.ilike(f"%{search}%"))
        )

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    # Apply pagination
    offset = (page - 1) * page_size
    result = await db.execute(
        query.order_by(Project.created_at.desc()).offset(offset).limit(page_size)
    )
    projects = result.scalars().all()


    # The persisted ML prediction is authoritative. Avoid displaying the
    # legacy denormalized project risk when a newer model result exists.
    prediction_by_project = {
        row.project_id: row for row in await latest_predictions(db)
    }
    items = []
    for project in projects:
        item = ProjectListResponse.model_validate(project)
        prediction = prediction_by_project.get(project.id)
        if prediction is not None:
            item.risk_level = RiskLevel(prediction.risk_category)
        items.append(item)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    payload: ProjectCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_officer),
) -> Project:
    """Create a new land acquisition project."""
    # Check for duplicate project code
    existing = await db.execute(
        select(Project).where(Project.project_code == payload.project_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Project code '{payload.project_code}' already exists.",
        )

    project = Project(
        **payload.model_dump(),
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(project)
    await db.flush()

    await record_audit_log(
        db=db,
        action="CREATE_PROJECT",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        resource_type="project",
        resource_id=project.id,
        ip_address=request.client.host if request.client else None,
        request_method="POST",
        request_path="/api/v1/projects/",
        response_status=201,
    )

    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    """Retrieve a single project by ID."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    # The immutable production prediction is the only source for displayed risk.
    prediction = await latest_prediction(db, project.id)
    if prediction is not None:
        project.risk_level = RiskLevel(prediction.risk_category)

    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_officer),
) -> Project:
    """Update project fields."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    update_data["updated_by"] = current_user.id

    for key, value in update_data.items():
        setattr(project, key, value)

    consistency_errors = validate_project_consistency(project)
    if consistency_errors:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=consistency_errors)

    await db.commit()
    await db.refresh(project)

    await record_audit_log(
        db=db,
        action="UPDATE_PROJECT",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        resource_type="project",
        resource_id=project.id,
        ip_address=request.client.host if request.client else None,
        request_method="PUT",
        request_path=f"/api/v1/projects/{project_id}",
        request_body=update_data,
        response_status=200,
    )

    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_officer),
) -> None:
    """Soft-delete a project (sets deleted_at timestamp)."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    await db.execute(
        update(Project)
        .where(Project.id == project_id)
        .values(deleted_at=datetime.now(tz=timezone.utc))
    )

    await record_audit_log(
        db=db,
        action="DELETE_PROJECT",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        resource_type="project",
        resource_id=project_id,
        ip_address=request.client.host if request.client else None,
        request_method="DELETE",
        request_path=f"/api/v1/projects/{project_id}",
        response_status=204,
    )
