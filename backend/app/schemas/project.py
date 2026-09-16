"""
LADRIS — Pydantic Schemas: Project
"""
from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.models.project import AcquisitionAct, ProjectStatus, ProjectType, RiskLevel


class ProjectCreate(BaseModel):
    project_code: str = Field(..., min_length=3, max_length=50)
    name: str = Field(..., min_length=3)
    description: Optional[str] = None
    project_type: ProjectType
    acquisition_act: AcquisitionAct = AcquisitionAct.RFCTLARR_2013
    state_code: str = Field(..., max_length=3)
    district_codes: List[str] = Field(default_factory=list)
    tehsil_names: List[str] = Field(default_factory=list)
    nodal_agency: Optional[str] = None
    executing_agency: Optional[str] = None
    total_area_ha: Optional[float] = Field(None, gt=0)
    area_acquired_ha: Optional[float] = Field(None, ge=0)
    area_in_possession_ha: Optional[float] = Field(None, ge=0)
    total_affected_families: Optional[int] = Field(None, ge=0)
    families_compensated: Optional[int] = Field(None, ge=0)
    families_rehabilitated: Optional[int] = Field(None, ge=0)
    rehabilitation_progress_pct: Optional[float] = Field(None, ge=0, le=100)
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    estimated_compensation_inr: Optional[float] = Field(None, ge=0)
    disbursed_compensation_inr: Optional[float] = Field(None, ge=0)
    notification_3a_date: Optional[date] = None
    notification_3d_date: Optional[date] = None
    delay_months: Optional[int] = Field(None, ge=0)
    delay_reason: Optional[str] = None
    legal_case_count: Optional[int] = Field(None, ge=0)
    legal_case_status: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

    @model_validator(mode="after")
    def validate_lifecycle(self):
        if self.planned_start_date and self.planned_end_date and self.planned_end_date < self.planned_start_date:
            raise ValueError("planned_end_date cannot precede planned_start_date")
        if self.notification_3a_date and self.notification_3d_date and self.notification_3d_date < self.notification_3a_date:
            raise ValueError("notification_3d_date cannot precede notification_3a_date")
        if self.estimated_compensation_inr is not None and self.disbursed_compensation_inr is not None and self.disbursed_compensation_inr > self.estimated_compensation_inr:
            raise ValueError("disbursed_compensation_inr cannot exceed estimated_compensation_inr")
        if self.total_affected_families is not None:
            if self.families_compensated is not None and self.families_compensated > self.total_affected_families:
                raise ValueError("families_compensated cannot exceed total_affected_families")
            if self.families_rehabilitated is not None and self.families_rehabilitated > self.total_affected_families:
                raise ValueError("families_rehabilitated cannot exceed total_affected_families")
        if self.total_area_ha is not None and self.area_acquired_ha is not None and self.area_acquired_ha > self.total_area_ha:
            raise ValueError("area_acquired_ha cannot exceed total_area_ha")
        if self.area_acquired_ha is not None and self.area_in_possession_ha is not None and self.area_in_possession_ha > self.area_acquired_ha:
            raise ValueError("area_in_possession_ha cannot exceed area_acquired_ha")
        return self


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    project_type: Optional[ProjectType] = None
    acquisition_act: Optional[AcquisitionAct] = None
    state_code: Optional[str] = Field(None, max_length=3)
    nodal_agency: Optional[str] = None
    executing_agency: Optional[str] = None
    district_codes: Optional[List[str]] = None
    tehsil_names: Optional[List[str]] = None
    total_area_ha: Optional[float] = Field(None, gt=0)
    area_acquired_ha: Optional[float] = Field(None, ge=0)
    area_in_possession_ha: Optional[float] = Field(None, ge=0)
    total_affected_families: Optional[int] = Field(None, ge=0)
    families_compensated: Optional[int] = Field(None, ge=0)
    families_rehabilitated: Optional[int] = Field(None, ge=0)
    rehabilitation_progress_pct: Optional[float] = Field(None, ge=0, le=100)
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    estimated_compensation_inr: Optional[float] = Field(None, ge=0)
    disbursed_compensation_inr: Optional[float] = Field(None, ge=0)
    notification_3a_date: Optional[date] = None
    notification_3d_date: Optional[date] = None
    delay_months: Optional[int] = Field(None, ge=0)
    delay_reason: Optional[str] = None
    legal_case_count: Optional[int] = Field(None, ge=0)
    legal_case_status: Optional[str] = None
    milestone_data_status: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    lacrris_integration_status: Optional[str] = None

    @model_validator(mode="after")
    def validate_lifecycle(self):
        if self.planned_start_date and self.planned_end_date and self.planned_end_date < self.planned_start_date:
            raise ValueError("planned_end_date cannot precede planned_start_date")
        if self.actual_start_date and self.actual_end_date and self.actual_end_date < self.actual_start_date:
            raise ValueError("actual_end_date cannot precede actual_start_date")
        if self.notification_3a_date and self.notification_3d_date and self.notification_3d_date < self.notification_3a_date:
            raise ValueError("notification_3d_date cannot precede notification_3a_date")
        if self.estimated_compensation_inr is not None and self.disbursed_compensation_inr is not None and self.disbursed_compensation_inr > self.estimated_compensation_inr:
            raise ValueError("disbursed_compensation_inr cannot exceed estimated_compensation_inr")
        if self.total_affected_families is not None:
            if self.families_compensated is not None and self.families_compensated > self.total_affected_families:
                raise ValueError("families_compensated cannot exceed total_affected_families")
            if self.families_rehabilitated is not None and self.families_rehabilitated > self.total_affected_families:
                raise ValueError("families_rehabilitated cannot exceed total_affected_families")
        return self


class ProjectResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    project_code: str
    name: str
    description: Optional[str] = None
    project_type: ProjectType
    acquisition_act: AcquisitionAct
    status: ProjectStatus
    risk_level: RiskLevel
    state_code: str
    district_codes: List[str]
    tehsil_names: Optional[List[str]] = None
    nodal_agency: Optional[str] = None
    executing_agency: Optional[str] = None
    total_area_ha: Optional[float] = None
    area_acquired_ha: Optional[float] = None
    area_in_possession_ha: Optional[float] = None
    total_affected_families: Optional[int] = None
    families_compensated: Optional[int] = None
    families_rehabilitated: Optional[int] = None
    rehabilitation_progress_pct: Optional[float] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    estimated_compensation_inr: Optional[float] = None
    disbursed_compensation_inr: Optional[float] = None
    notification_3a_date: Optional[date] = None
    notification_3d_date: Optional[date] = None
    delay_months: Optional[int] = None
    delay_reason: Optional[str] = None
    legal_case_count: Optional[int] = 0
    legal_case_status: Optional[str] = "NONE"
    milestone_data_status: Optional[str] = "USER_ENTERED"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    lacrris_integration_status: Optional[str] = "PLANNED"
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    project_code: str
    name: str
    project_type: ProjectType
    status: ProjectStatus
    risk_level: RiskLevel
    state_code: str
    district_codes: List[str] = Field(default_factory=list)
    nodal_agency: Optional[str] = None
    executing_agency: Optional[str] = None
    total_area_ha: Optional[float] = None
    total_affected_families: Optional[int] = None
    planned_end_date: Optional[date] = None
    delay_months: Optional[int] = None
    delay_reason: Optional[str] = None
    milestone_data_status: Optional[str] = "USER_ENTERED"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    priority_score: Optional[float] = None
    top_bottleneck: Optional[str] = None
    created_at: datetime


