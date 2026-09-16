"""
LADRIS — SQLAlchemy Model: ProjectIntervention
Stores real actions taken by officials and compares before/after ML risk metrics.
"""
import uuid
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ProjectIntervention(Base):
    """
    Stores logged official interventions and tracks ML prediction impact before and after.
    """
    __tablename__ = "project_interventions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    intervention_type = Column(String(100), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    action_taken_by = Column(String(255), nullable=True)
    action_date = Column(Date, nullable=False, server_default=func.current_date())

    # Risk Before
    risk_score_before = Column(Float, nullable=False)
    risk_category_before = Column(String(20), nullable=False)
    predicted_delay_before = Column(Float, nullable=True)

    # Risk After
    risk_score_after = Column(Float, nullable=False)
    risk_category_after = Column(String(20), nullable=False)
    predicted_delay_after = Column(Float, nullable=True)

    # Improvements
    risk_score_reduction = Column(Float, nullable=True)
    delay_reduction_days = Column(Float, nullable=True)
    status_improved = Column(Boolean, default=False)

    # Model metadata
    model_version = Column(String(50), nullable=False)
    prediction_timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationship
    project = relationship("Project", lazy="select")
