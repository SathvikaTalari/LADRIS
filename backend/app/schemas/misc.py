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

class AlertSettingsSchema(BaseModel):
    email_notifications_enabled: bool = True
    sms_notifications_enabled: bool = False
    send_high_critical_only: bool = True
    reminder_hours: int = 24  # 24, 48, or 0 (Off)
    high_risk_alert_score: int = 75
    priority_action_score: int = 70
    minimum_data_completeness: int = 60

class AlertResponse(AlertBase):
    id: UUID
    project_id: Optional[UUID] = None
    project_name: Optional[str] = None
    alert_reason: Optional[str] = None
    explanation: Optional[str] = None
    # Email delivery status
    email_sent: bool = False
    email_sent_at: Optional[datetime] = None
    email_recipient: Optional[str] = None
    # SMS delivery status
    sms_sent: bool = False
    sms_sent_at: Optional[datetime] = None
    sms_recipient: Optional[str] = None
    triggered_at: datetime
    acknowledged_by: Optional[UUID] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class NotificationLogResponse(BaseModel):
    id: int
    alert_id: Optional[UUID] = None
    channel: str          # "email" | "sms"
    recipient: Optional[str] = None
    status: str           # "SENT" | "FAILED" | "SIMULATED"
    sent_at: datetime
    error_msg: Optional[str] = None
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
