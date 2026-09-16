"""
Automated alert generation for high-risk projects.

The PS requires:
- "Generate automated alerts for high-risk projects"
- "Recommend preventive measures to administrators"

This module scans all scored projects, identifies high-risk ones,
generates alerts with severity levels, and provides actionable recommendations.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.db.schema import RiskScore
from app.notifications.dispatch import NotificationDispatcher


def dispatch_alerts(alerts: list[dict]) -> dict:
    """Send alerts through configured notification channels."""
    dispatcher = NotificationDispatcher()
    results = []
    for alert in alerts:
        results.append(dispatcher.dispatch(alert))
    return {"total": len(results), "results": results}


SEVERITY_HIGH = "critical"
SEVERITY_MEDIUM = "warning"
SEVERITY_LOW = "info"

ALERT_TEMPLATES = {
    "critical": {
        "title": "CRITICAL: Project at High Risk of Delay",
        "cooldown_hours": 24,
        "channels": ["email", "sms", "dashboard"],
    },
    "warning": {
        "title": "WARNING: Project Showing Delay Indicators",
        "cooldown_hours": 72,
        "channels": ["email", "dashboard"],
    },
    "info": {
        "title": "INFO: Project Status Update",
        "cooldown_hours": 168,
        "channels": ["dashboard"],
    },
}


def generate_alerts(session: Session, risk_threshold: float = 70.0) -> list[dict]:
    """Generate alerts for all projects exceeding the risk threshold.

    Returns a list of alert dicts with:
      project_id, project_name, risk_score, severity, alert_type,
      message, recommendations, channels, cooldown_hours
    """
    scores = session.query(RiskScore).order_by(RiskScore.risk_score.desc()).all()
    if not scores:
        return []

    # Get project info for each score
    alerts = []
    seen_projects = set()

    for score in scores:
        if score.risk_score < risk_threshold:
            continue

        project_id = score.project_id
        if project_id in seen_projects:
            continue
        seen_projects.add(project_id)

        severity = _determine_severity(score.risk_score)
        template = ALERT_TEMPLATES.get(severity, ALERT_TEMPLATES["info"])

        recommendations = json.loads(score.recommendations_json) if score.recommendations_json else []
        drivers = json.loads(score.top_drivers_json) if score.top_drivers_json else []

        alert = {
            "alert_id": f"alert-{project_id}-{score.predicted_at.strftime('%Y%m%d%H%M')}",
            "project_id": project_id,
            "severity": severity,
            "risk_score": score.risk_score,
            "risk_category": score.risk_category.value,
            "alert_type": "delay_prediction",
            "title": template["title"],
            "message": _build_alert_message(score, drivers),
            "drivers": [d.get("label", d.get("feature", "")) for d in drivers],
            "recommendations": recommendations,
            "channels": template["channels"],
            "cooldown_hours": template["cooldown_hours"],
            "generated_at": score.predicted_at,
            "model_version": score.model_version,
        }
        alerts.append(alert)

    return alerts


def _determine_severity(risk_score: float) -> str:
    """Map risk score to alert severity."""
    if risk_score >= 85:
        return SEVERITY_HIGH
    if risk_score >= 60:
        return SEVERITY_MEDIUM
    return SEVERITY_LOW


def _build_alert_message(score: RiskScore, drivers: list[dict]) -> str:
    """Build a human-readable alert message."""
    parts = [
        f"Project {score.project_id} has been assigned a risk score of {score.risk_score}/100",
        f"Risk category: {score.risk_category.value}",
    ]

    if drivers:
        top_driver = drivers[0].get("label", drivers[0].get("feature", "Unknown"))
        parts.append(f"Primary delay driver: {top_driver}")
        parts.append(f"Impact score: {abs(drivers[0].get('impact', 0)):.4f}")

    if score.predicted_delay_days:
        parts.append(f"Predicted delay: {score.predicted_delay_days:.0f} days")

    return ". ".join(parts) + "."


def check_alerts_for_project(session: Session, project_id: str) -> list[dict]:
    """Check if a specific project has generated any alerts."""
    scores = (
        session.query(RiskScore)
        .filter_by(project_id=project_id)
        .order_by(RiskScore.predicted_at.desc())
        .all()
    )
    if not scores:
        return []

    alerts = []
    for score in scores:
        if score.risk_score < 40:
            continue
        severity = _determine_severity(score.risk_score)
        alerts.append({
            "risk_score": score.risk_score,
            "severity": severity,
            "category": score.risk_category.value,
            "drivers": json.loads(score.top_drivers_json) if score.top_drivers_json else [],
            "recommendations": json.loads(score.recommendations_json) if score.recommendations_json else [],
        })
    return alerts


def get_alert_summary(session: Session) -> dict[str, Any]:
    """Get a summary of all alerts for dashboard display."""
    alerts = generate_alerts(session)
    critical = [a for a in alerts if a["severity"] == SEVERITY_HIGH]
    warning = [a for a in alerts if a["severity"] == SEVERITY_MEDIUM]
    info = [a for a in alerts if a["severity"] == SEVERITY_LOW]

    return {
        "total_alerts": len(alerts),
        "critical": len(critical),
        "warning": len(warning),
        "info": len(info),
        "critical_projects": [
            {"project_id": a["project_id"], "risk_score": a["risk_score"]}
            for a in critical
        ],
        "generated_at": datetime.utcnow(),
    }
