"""
LADRIS — SQLAlchemy ORM Models: ML Model Registry, Data Quality, Prediction Log,
                                       Intervention Recommendations & Intervention Scenarios (Phase 4)
"""

import enum
import uuid
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Float,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class PredictionStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    ERROR = "ERROR"
    PENDING = "PENDING"


class MLModelType(str, enum.Enum):
    ANOMALY_SCORER = "ANOMALY_SCORER"
    BINARY_CLASSIFIER = "BINARY_CLASSIFIER"
    REGRESSION = "REGRESSION"


class MLModelRegistry(Base):
    __tablename__ = "ml_model_registry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String(255), nullable=False)
    model_version = Column(String(50), unique=True, nullable=False)
    model_type = Column(Enum(MLModelType, name="ml_model_type"), nullable=False)
    training_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    dataset_version = Column(String(100), nullable=True)
    record_count_used = Column(Integer, nullable=True)
    feature_list = Column(JSONB, nullable=False, default=list)
    evaluation_metrics = Column(JSONB, nullable=False, default=dict)
    model_path = Column(Text, nullable=True)
    preprocessing_path = Column(Text, nullable=True)
    is_current = Column(Boolean, nullable=False, default=False)
    authenticity_statement = Column(Text, nullable=False)
    data_sources_used = Column(ARRAY(String), nullable=False, default=list)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class DataQualitySnapshot(Base):
    __tablename__ = "data_quality_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    data_source_id = Column(UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=True)
    total_records = Column(Integer, nullable=False, default=0)
    valid_records = Column(Integer, nullable=False, default=0)
    invalid_records = Column(Integer, nullable=False, default=0)
    duplicate_records = Column(Integer, nullable=False, default=0)
    missing_value_rate = Column(Numeric(5, 4), nullable=True)
    prediction_eligible = Column(Integer, nullable=False, default=0)
    quality_issues = Column(JSONB, nullable=False, default=dict)
    field_null_rates = Column(JSONB, nullable=False, default=dict)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PredictionLog(Base):
    __tablename__ = "prediction_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    model_version = Column(String(50), nullable=False)
    dataset_version = Column(String(100), nullable=True)
    prediction_status = Column(Enum(PredictionStatus, name="prediction_status"), nullable=False)
    anomaly_score = Column(Numeric(5, 4), nullable=True)
    delay_probability = Column(Numeric(5, 4), nullable=True)  # Always NULL while supervised deferred
    stage_fingerprint_risk = Column(Numeric(5, 4), nullable=True)
    data_completeness_pct = Column(Numeric(5, 2), nullable=False, default=0.0)
    prediction_eligible = Column(Boolean, nullable=False, default=True)
    feature_contributions = Column(JSONB, nullable=False, default=list)
    confidence_assessment = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class MLPrediction(Base):
    """Immutable point-in-time output from the production delay model."""
    __tablename__ = "ml_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_date = Column(DateTime(timezone=True), nullable=False, index=True)
    model_version = Column(String(50), nullable=False, index=True)
    feature_snapshot = Column(JSONB, nullable=False)
    delay_probability = Column(Float, nullable=False)
    risk_score = Column(Float, nullable=False)
    risk_category = Column(String(10), nullable=False, index=True)
    predicted_delay_days = Column(Float, nullable=True)
    prediction_interval = Column(JSONB, nullable=False, default=dict)
    stage_predictions = Column(JSONB, nullable=False, default=list)
    top_drivers = Column(JSONB, nullable=False, default=list)
    recommendations = Column(JSONB, nullable=False, default=list)
    validation = Column(JSONB, nullable=False, default=dict)
    latency_ms = Column(Float, nullable=True)
    predicted_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)


class ProjectRiskSnapshot(Base):
    __tablename__ = "project_risk_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    risk_type = Column(String(50), nullable=False, default="structural_anomaly")
    risk_score = Column(Numeric(8, 4), nullable=False, default=0.0)
    anomaly_score = Column(Numeric(8, 6), nullable=True)
    stage_fingerprint_risk = Column(Numeric(8, 6), nullable=True)
    risk_level = Column(String(20), nullable=True)
    data_completeness_pct = Column(Numeric(5, 2), nullable=True)
    model_version = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())



# ─── Phase 4: Intervention Intelligence Models ────────────────────────────────

class InterventionRecommendation(Base):
    """
    Stores generated intervention recommendations per project.

    CRITICAL: record_type is always 'RECOMMENDATION — NOT GOVERNMENT ACTION'.
    This table stores DECISION-SUPPORT outputs only.
    It must NEVER be used to record actual government decisions.
    """
    __tablename__ = "intervention_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    intervention_id = Column(String(50), nullable=False)   # References catalog ID
    category = Column(String(50), nullable=False)
    stage = Column(String(50), nullable=False)
    display_name = Column(Text, nullable=False)
    priority_score = Column(Integer, nullable=False)       # 0–100 Decision-Support score
    priority_label = Column(String(50), nullable=True)     # CRITICAL/HIGH/MEDIUM/LOW PRIORITY
    score_components = Column(JSONB, nullable=False, default=dict)  # Full breakdown
    confidence = Column(String(20), nullable=False)        # HIGH/MEDIUM/LOW
    evidence_reference = Column(Text, nullable=True)
    provenance = Column(String(255), nullable=True)
    triggering_rules = Column(JSONB, nullable=False, default=list)
    risk_drivers = Column(JSONB, nullable=False, default=list)
    model_supported_contributors = Column(JSONB, nullable=False, default=list)  # SHAP connections
    data_completeness_pct = Column(Numeric(5, 2), nullable=True)
    model_version = Column(String(50), nullable=True)

    # MANDATORY: All rows are DECISION-SUPPORT only
    record_type = Column(
        String(100),
        nullable=False,
        default="RECOMMENDATION — NOT GOVERNMENT ACTION",
    )

    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class InterventionScenario(Base):
    """
    Stores what-if simulation runs.

    CRITICAL: record_type is always 'SCENARIO — NOT ACTUAL GOVERNMENT ACTION'.
    Simulations are strictly read-only with respect to project records.
    This table records the audit trail of simulation requests only.
    """
    __tablename__ = "intervention_scenarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scenario_name = Column(String(100), nullable=False)
    scenario_inputs = Column(JSONB, nullable=False, default=dict)   # What was changed
    baseline_signals = Column(JSONB, nullable=False, default=dict)  # Before scenario
    scenario_signals = Column(JSONB, nullable=False, default=dict)  # After scenario
    delta_signals = Column(JSONB, nullable=False, default=dict)     # Differences
    priority_score = Column(Integer, nullable=True)
    score_components = Column(JSONB, nullable=True)
    confidence = Column(String(20), nullable=True)
    evidence_reference = Column(Text, nullable=True)
    data_version = Column(String(100), nullable=True)
    model_version = Column(String(50), nullable=True)

    # MANDATORY: All rows are SCENARIO outputs only
    record_type = Column(
        String(100),
        nullable=False,
        default="SCENARIO — NOT ACTUAL GOVERNMENT ACTION",
    )

    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
