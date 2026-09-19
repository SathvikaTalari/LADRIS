from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from uuid import UUID
from app.models.misc import AlertType, AlertSeverity, AlertStatus

class AlertBase(BaseModel):
    alert_type: AlertType
    severity: AlertSeverity
    status: AlertStatus
    title: str
    message: str
    alert_metadata: Dict[str, Any] = Field(default_factory=dict)
    
class AlertCreate(AlertBase):
    project_id: Optional[UUID] = None

class AlertUpdate(BaseModel):
    status: AlertStatus

class AlertResponse(AlertBase):
    id: UUID
    project_id: Optional[UUID] = None
    project_name: Optional[str] = None
    alert_reason: Optional[str] = None
    explanation: Optional[str] = None
    triggered_at: datetime
    acknowledged_by: Optional[UUID] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class GlobalSearchResult(BaseModel):
    project_id: UUID
    project_name: str
    project_identifier: str
    state: str
    district: str
    agency: str
    match_type: str
    priority_score: Optional[float] = None
