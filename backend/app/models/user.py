"""
LADRIS — SQLAlchemy ORM Models: User
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    CENTRAL_ADMIN = "CENTRAL_ADMIN"
    STATE_ADMIN = "STATE_ADMIN"
    DISTRICT_OFFICER = "DISTRICT_OFFICER"
    LA_OFFICER = "LA_OFFICER"
    PROJECT_OFFICER = "PROJECT_OFFICER"
    PROJECT_AGENCY = "PROJECT_AGENCY"
    POLICY_ANALYST = "POLICY_ANALYST"
    ANALYST = "ANALYST"
    VIEWER = "VIEWER"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(512), nullable=False)
    role = Column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.VIEWER,
    )
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)

    state_code = Column(String(3), nullable=True)
    district_code = Column(String(10), nullable=True)
    agency_name = Column(String(255), nullable=True)
    phone_number = Column(String(20), nullable=True)   # For SMS alert delivery
    assigned_project_ids = Column(String(1024), nullable=True)  # Comma-separated or JSON string of assigned UUIDs

    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"

