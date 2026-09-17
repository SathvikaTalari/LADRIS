"""
LADRIS — API v1 Router Assembly (Phase 8 — Real Data ETL)
"""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.projects import router as projects_router
from app.api.v1.predictions import (
    predictions_router,
    models_router,
    data_quality_router,
)
from app.api.v1.data_sources import data_sources_router
from app.api.v1.monitoring import monitoring_router
from app.api.v1.interventions import interventions_router  # Phase 4 — real implementation
from app.api.v1.production_intelligence import intelligence_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.search import router as search_router
from app.api.v1.reports import router as reports_router
from app.api.v1.etl import etl_router
from app.api.v1.audit import audit_router
from app.api.v1.chatbot import router as chatbot_router
from app.api.v1.ingestion import router as ingestion_router
from app.api.v1.decision_intelligence import router as decision_intelligence_router
from app.api.v1.stubs import (
    analytics_router,
    gis_router,
    stages_router,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(ingestion_router)
api_router.include_router(stages_router)
api_router.include_router(predictions_router)
api_router.include_router(models_router)
api_router.include_router(data_sources_router)
api_router.include_router(data_quality_router)
api_router.include_router(monitoring_router)
api_router.include_router(interventions_router)
api_router.include_router(intelligence_router)
api_router.include_router(alerts_router)
api_router.include_router(search_router)
api_router.include_router(reports_router)
api_router.include_router(gis_router)
api_router.include_router(analytics_router)
api_router.include_router(etl_router)
api_router.include_router(audit_router)
api_router.include_router(chatbot_router)
api_router.include_router(decision_intelligence_router)
