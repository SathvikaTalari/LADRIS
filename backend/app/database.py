"""
LADRIS — Async SQLAlchemy Database Engine & Session
Handles missing database gracefully on startup — the app will start
and retry on first request rather than crashing immediately.
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()


_connect_args = {
    "timeout": 10,    # asyncpg connect timeout (seconds)
    "command_timeout": 30,
}
if getattr(settings, "POSTGRES_SSL", False) or any(
    host_indicator in settings.DATABASE_URL
    for host_indicator in ["supabase.co", "neon.tech", "render.com", "pooler.supabase.com", "amazonaws.com", "aivencloud.com"]
):
    _connect_args["ssl"] = "require"

# Create async engine with connection retry / resilience settings
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,           # set True only for deep SQL debugging
    pool_pre_ping=True,   # verify connection health before checkout
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,     # recycle connections every 5 minutes
    pool_timeout=10,      # wait up to 10s for a connection slot
    connect_args=_connect_args,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_connection() -> bool:
    """Health check: ping the database. Returns False instead of raising."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(__import__("sqlalchemy").text("SELECT 1"))
        return True
    except Exception:
        return False
