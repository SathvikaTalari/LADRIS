"""
LADRIS — FastAPI Dependencies: Auth & RBAC
"""
import time
from typing import List
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.services.auth_service import decode_token

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency: Decode JWT bearer token, return the active User.
    Raises 401 if token is invalid or user does not exist/is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        user_id = UUID(payload.user_id)
    except (JWTError, ValueError, AttributeError):
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """
    Dependency: Optional user check. Returns User if valid token present, else None.
    """
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        user_id = UUID(payload.user_id)
        result = await db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if user and user.is_active:
            return user
    except Exception:
        pass
    return None


def require_roles(*roles: UserRole):
    """
    Dependency factory: returns a dependency that enforces role-based access.

    Usage:
        @router.get("/admin", dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in roles]}",
            )
        return current_user

    return role_checker


# Role dependency shortcuts
require_admin = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.CENTRAL_ADMIN,
    UserRole.STATE_ADMIN,
)
require_officer = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.CENTRAL_ADMIN,
    UserRole.STATE_ADMIN,
    UserRole.DISTRICT_OFFICER,
    UserRole.LA_OFFICER,
    UserRole.PROJECT_OFFICER,
    UserRole.PROJECT_AGENCY,
)
require_analyst = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.CENTRAL_ADMIN,
    UserRole.STATE_ADMIN,
    UserRole.DISTRICT_OFFICER,
    UserRole.LA_OFFICER,
    UserRole.PROJECT_OFFICER,
    UserRole.PROJECT_AGENCY,
    UserRole.POLICY_ANALYST,
    UserRole.ANALYST,
    UserRole.VIEWER,
)


def enforce_district_scope(current_user: User, requested_district_code: str | None) -> None:
    """
    Enforce district-level data access control.
    If user is a DISTRICT_OFFICER and requests data for a different district, raise HTTP 403.
    """
    if current_user.role == UserRole.DISTRICT_OFFICER:
        if current_user.district_code and requested_district_code:
            if current_user.district_code.lower() != requested_district_code.lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Your jurisdiction is restricted to district {current_user.district_code}.",
                )


def enforce_state_scope(current_user: User, requested_state_code: str | None) -> None:
    """
    Enforce state-level data access control.
    If user is a STATE_ADMIN and requests data for a different state, raise HTTP 403.
    """
    if current_user.role == UserRole.STATE_ADMIN:
        if current_user.state_code and requested_state_code:
            if current_user.state_code.upper() != requested_state_code.upper():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Your jurisdiction is restricted to state {current_user.state_code}.",
                )

