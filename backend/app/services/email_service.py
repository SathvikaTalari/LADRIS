"""
LADRIS — Lightweight Alert Email Notification Service
=====================================================
Dispatches concise, standardized email alerts to responsible officers when
high/critical risk alerts or serious statutory roadblocks occur.
"""
import asyncio
from datetime import datetime, timezone
from email.message import EmailMessage
import json
import logging
from pathlib import Path
import smtplib
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User, UserRole
from app.models.misc import AlertSeverity, AlertStatus, NotificationLog

logger = logging.getLogger("ladris.email_service")
settings = get_settings()


def format_alert_email(
    project_name: str,
    risk_level: str,
    predicted_delay: str,
    main_issue: str,
    current_stage: str,
    project_id: Optional[UUID] = None,
) -> Dict[str, str]:
    """
    Format the standardized email body with ONLY the 6 requested fields:
      1. Project Name
      2. Risk Level
      3. Predicted Delay
      4. Main Issue
      5. Current Stage
      6. View Project link
    """
    frontend_url = settings.APP_FRONTEND_URL.rstrip("/")
    view_project_link = (
        f"{frontend_url}/projects/{project_id}"
        if project_id
        else f"{frontend_url}/projects"
    )

    subject = f"[LADRIS ALERT] {risk_level} Risk Alert - {project_name}"

    # Plain text version
    text_content = f"""LADRIS — Land Acquisition Delay Risk Intelligence Alert
============================================================

An urgent delay risk alert has been generated for your assigned project.

1. Project Name:    {project_name}
2. Risk Level:      {risk_level}
3. Predicted Delay: {predicted_delay}
4. Main Issue:      {main_issue}
5. Current Stage:   {current_stage}

View Project in LADRIS:
{view_project_link}

------------------------------------------------------------
Ministry of Rural Development / NHAI • Secure Government Platform
This is an automated decision intelligence notification.
"""

    # Executive, lightweight HTML version (mobile & desktop compatible)
    risk_color = (
        "#ef4444"
        if risk_level in ("CRITICAL", "HIGH")
        else ("#f59e0b" if risk_level == "MEDIUM" else "#10b981")
    )

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f0f4f9; color: #0a1d37;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #dce4ee; overflow: hidden; box-shadow: 0 4px 16px rgba(10,29,55,0.06);">
    <!-- Header -->
    <tr>
      <td style="padding: 20px 24px; background: #003366; color: #ffffff;">
        <div style="font-size: 18px; font-weight: 800; letter-spacing: 0.03em;">LADRIS</div>
        <div style="font-size: 11px; color: #94b8e0; margin-top: 2px;">Land Acquisition Delay Risk Intelligence System</div>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 24px;">
        <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: {risk_color}; margin-bottom: 8px;">
          ⚠ Priority Statutory Alert
        </div>
        <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 800; color: #0a1d37; line-height: 1.3;">
          {project_name}
        </h2>

        <!-- 6 Core Fields Table -->
        <table width="100%" border="0" cellspacing="0" cellpadding="8" style="background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; margin-bottom: 20px;">
          <tr>
            <td width="35%" style="color: #5a7194; font-weight: 600; border-bottom: 1px solid #edf2f7;">Project Name:</td>
            <td style="color: #0a1d37; font-weight: 700; border-bottom: 1px solid #edf2f7;">{project_name}</td>
          </tr>
          <tr>
            <td style="color: #5a7194; font-weight: 600; border-bottom: 1px solid #edf2f7;">Risk Level:</td>
            <td style="border-bottom: 1px solid #edf2f7;">
              <span style="background: {risk_color}; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px;">{risk_level}</span>
            </td>
          </tr>
          <tr>
            <td style="color: #5a7194; font-weight: 600; border-bottom: 1px solid #edf2f7;">Predicted Delay:</td>
            <td style="color: #b91c1c; font-weight: 700; border-bottom: 1px solid #edf2f7;">{predicted_delay}</td>
          </tr>
          <tr>
            <td style="color: #5a7194; font-weight: 600; border-bottom: 1px solid #edf2f7;">Main Issue:</td>
            <td style="color: #0a1d37; font-weight: 600; border-bottom: 1px solid #edf2f7;">{main_issue}</td>
          </tr>
          <tr>
            <td style="color: #5a7194; font-weight: 600;">Current Stage:</td>
            <td style="color: #003366; font-weight: 700;">{current_stage}</td>
          </tr>
        </table>

        <!-- View Project Button -->
        <div style="text-align: center; margin: 24px 0 12px 0;">
          <a href="{view_project_link}" style="background: #003366; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 13px; display: inline-block;">
            View Project Details in LADRIS →
          </a>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 16px 24px; background: #f0f4f9; border-top: 1px solid #dce4ee; font-size: 11px; color: #64748b; text-align: center;">
        Ministry of Rural Development • Government of India<br>
        Automated alert generated by LADRIS Delay Prediction Engine.
      </td>
    </tr>
  </table>
</body>
</html>
"""

    return {
        "subject": subject,
        "text": text_content,
        "html": html_content,
    }


def send_alert_email_sync(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: str,
) -> Dict[str, Any]:
    """
    Synchronously send email over SMTP with fallback to development simulation logging.
    Never raises an uncaught exception to ensure callers are never disrupted.
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    if not settings.SMTP_ENABLED:
        logger.info("Email notifications disabled via SMTP_ENABLED=False")
        return {"sent": False, "mode": "DISABLED", "to": to_email, "timestamp": timestamp}

    # If no SMTP credentials configured, operate in graceful developer simulation mode
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info(
            f"[EMAIL NOTIFICATION DISPATCHED - Developer Mode] To: {to_email} | Subject: {subject}"
        )
        return {
            "sent": True,
            "mode": "SIMULATED",
            "to": to_email,
            "timestamp": timestamp,
        }

    # Live SMTP Dispatch
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg.set_content(body_text)
        msg.add_alternative(body_html, subtype="html")

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"✅ Email delivered via SMTP to {to_email}")
        return {
            "sent": True,
            "mode": "SMTP",
            "to": to_email,
            "timestamp": timestamp,
        }
    except Exception as e:
        logger.warning(f"⚠️ Failed to deliver SMTP email to {to_email}: {e}")
        return {
            "sent": False,
            "mode": "ERROR",
            "error": str(e),
            "to": to_email,
            "timestamp": timestamp,
        }


async def send_alert_email_async(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: str,
) -> Dict[str, Any]:
    """Execute SMTP network call in a worker thread so it never blocks FastAPI."""
    return await asyncio.to_thread(
        send_alert_email_sync, to_email, subject, body_text, body_html
    )


async def resolve_officer_email(
    db: AsyncSession,
    project_id: Optional[UUID] = None,
    state_code: Optional[str] = None,
) -> str:
    """
    Resolves the most appropriate officer email for a project.
    Hierarchy:
      1. User explicitly assigned to this project_id
      2. Land Acquisition Officer / Project Officer in the project's state
      3. Global default officer email (from settings)
    """
    try:
        if project_id:
            pid_str = str(project_id)
            res = await db.execute(
                select(User).where(
                    User.is_active.is_(True),
                    User.assigned_project_ids.isnot(None),
                )
            )
            for user in res.scalars():
                if user.assigned_project_ids and pid_str in user.assigned_project_ids:
                    return user.email

        if state_code:
            res = await db.execute(
                select(User).where(
                    User.is_active.is_(True),
                    User.state_code == state_code,
                    User.role.in_([UserRole.PROJECT_OFFICER, UserRole.LA_OFFICER, UserRole.DISTRICT_OFFICER]),
                ).limit(1)
            )
            matched_user = res.scalar_one_or_none()
            if matched_user and matched_user.email:
                return matched_user.email

        # Generic officer fallback
        res = await db.execute(
            select(User).where(
                User.is_active.is_(True),
                User.role.in_([UserRole.PROJECT_OFFICER, UserRole.LA_OFFICER]),
            ).limit(1)
        )
        officer = res.scalar_one_or_none()
        if officer and officer.email:
            return officer.email
    except Exception as e:
        logger.debug(f"Could not resolve officer from database: {e}")

    return getattr(settings, "DEFAULT_ALERT_EMAIL", "officer@ladris.gov.in")


SETTINGS_FILE = Path(__file__).resolve().parents[2] / "data" / "alert_settings.json"

DEFAULT_ALERT_SETTINGS = {
    "email_notifications_enabled": True,
    "sms_notifications_enabled": False,
    "send_high_critical_only": True,
    "reminder_hours": 24,
    "high_risk_alert_score": 75,
    "priority_action_score": 70,
    "minimum_data_completeness": 60,
}


def get_alert_settings() -> Dict[str, Any]:
    """Load alert configuration with fallback to default values."""
    settings_dict = DEFAULT_ALERT_SETTINGS.copy()
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    settings_dict.update(saved)
        except Exception as e:
            logger.warning(f"Error loading alert settings: {e}")
    return settings_dict


def save_alert_settings(new_settings: Dict[str, Any]) -> Dict[str, Any]:
    """Persist alert configuration to data/alert_settings.json."""
    current = get_alert_settings()
    current.update(new_settings)
    try:
        SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving alert settings: {e}")
    return current


async def trigger_alert_email_if_needed(
    db: AsyncSession,
    alert: Any,
    project: Optional[Any] = None,
    current_risk_score: Optional[float] = None,
) -> bool:
    """
    Check alert criteria, deduplicate notifications, and asynchronously send
    an email to the responsible officer when appropriate.
    Returns True if an email dispatch was initiated, False otherwise.
    """
    config = get_alert_settings()

    # 1. Master toggle check
    if not config.get("email_notifications_enabled", True):
        return False

    # 2. Check alert severity / importance
    meta = alert.alert_metadata or {}
    severity = getattr(alert, "severity", None)
    is_high_or_crit = severity in (AlertSeverity.CRITICAL, AlertSeverity.HIGH) or (
        meta.get("risk_level") in ("CRITICAL", "HIGH")
    )
    
    score = current_risk_score if current_risk_score is not None else meta.get("risk_score")
    if score is not None:
        try:
            if float(score) >= float(config.get("high_risk_alert_score", 75)):
                is_high_or_crit = True
        except (ValueError, TypeError):
            pass

    is_important_cause = getattr(alert, "title", "") in (
        "High Delay Risk",
        "Compensation Pending",
        "Legal Dispute",
        "R&R Delay",
        "Stage Overdue",
        "Risk Increased",
    ) or meta.get("alert_reason") in (
        "High Delay Risk",
        "Compensation Pending",
        "Legal Dispute",
        "R&R Delay",
        "Stage Overdue",
        "Risk Increased",
    )

    if config.get("send_high_critical_only", True):
        if not (is_high_or_crit or is_important_cause):
            return False

    # 3. Deduplication check
    already_sent = meta.get("email_sent", False)
    last_sent_at_str = meta.get("email_sent_at")
    last_sent_score = meta.get("last_sent_risk_score")

    if already_sent:
        should_resend = False

        # Condition A: Risk score significantly increased (>= 10 points)
        if score is not None and last_sent_score is not None:
            try:
                if (float(score) - float(last_sent_score)) >= 10.0:
                    should_resend = True
            except (ValueError, TypeError):
                pass

        # Condition B: Reminder time reached (24 / 48 hours)
        reminder_hours = int(config.get("reminder_hours", 24))
        if not should_resend and reminder_hours > 0 and last_sent_at_str:
            try:
                sent_at = datetime.fromisoformat(last_sent_at_str.replace("Z", "+00:00"))
                elapsed_hours = (datetime.now(timezone.utc) - sent_at).total_seconds() / 3600.0
                if elapsed_hours >= reminder_hours:
                    should_resend = True
            except Exception:
                pass

        if not should_resend:
            return False

    # 4. Extract the 6 exact fields
    pname = (
        getattr(project, "name", None)
        or meta.get("project_name")
        or "Land Acquisition Project"
    )
    risk_level = (
        "CRITICAL"
        if severity == AlertSeverity.CRITICAL or (score and float(score) >= 90)
        else ("HIGH" if severity == AlertSeverity.HIGH or (score and float(score) >= 70) else "MEDIUM")
    )
    if meta.get("predicted_delay_days"):
        pred_delay = f"{float(meta['predicted_delay_days']):.0f} days"
    elif project and getattr(project, "delay_months", None):
        pred_delay = f"{project.delay_months} months"
    else:
        pred_delay = "3 - 6 months (estimated)"

    main_issue = getattr(alert, "title", None) or meta.get("alert_reason") or "High Delay Risk"

    current_stage = (
        meta.get("critical_stage")
        or getattr(project, "milestone_data_status", None)
        or "Section 19 (Declaration)"
    )

    # 5. Resolve officer email
    state_code = getattr(project, "state_code", None) or meta.get("state_code")
    to_email = await resolve_officer_email(db, project_id=alert.project_id, state_code=state_code)

    # 6. Format content
    email_data = format_alert_email(
        project_name=pname,
        risk_level=risk_level,
        predicted_delay=pred_delay,
        main_issue=main_issue,
        current_stage=current_stage,
        project_id=alert.project_id,
    )

    # 7. Dispatch in background (non-blocking)
    asyncio.create_task(
        send_alert_email_async(
            to_email=to_email,
            subject=email_data["subject"],
            body_text=email_data["text"],
            body_html=email_data["html"],
        )
    )

    # 8. Update delivery status on alert metadata
    updated_meta = dict(meta)
    updated_meta["email_sent"] = True
    updated_meta["email_sent_at"] = datetime.now(timezone.utc).isoformat()
    updated_meta["email_recipient"] = to_email
    updated_meta["email_status"] = "SENT"
    if score is not None:
        try:
            updated_meta["last_sent_risk_score"] = float(score)
        except (ValueError, TypeError):
            pass
    alert.alert_metadata = updated_meta

    # 9. Persist notification log row (committed by caller)
    try:
        log_entry = NotificationLog(
            alert_id=alert.id,
            channel="email",
            recipient=to_email,
            status="SENT",
        )
        db.add(log_entry)
    except Exception as _log_err:
        logger.debug(f"Could not write email notification log: {_log_err}")

    return True
