"""
LADRIS — Lightweight Alert SMS Notification Service
====================================================
Dispatches concise SMS alerts to responsible officers when high/critical risk
alerts are triggered. Uses Twilio; falls back to developer simulation logging
when credentials are not configured.

Mirrors email_service.py in structure: same deduplication, same background
dispatch pattern, same graceful failure handling.
"""
import asyncio
from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User, UserRole
from app.models.misc import AlertSeverity, NotificationLog

logger = logging.getLogger("ladris.sms_service")
settings = get_settings()


def format_alert_sms(
    project_name: str,
    risk_level: str,
    risk_score: Optional[float],
    predicted_delay: str,
    main_issue: str,
    project_id: Optional[UUID] = None,
) -> str:
    """
    Build a concise SMS body containing exactly the requested fields:
      1. Project Name
      2. Risk Level + Risk Score
      3. Predicted Delay
      4. Main Issue
      5. View Project link
    """
    frontend_url = settings.APP_FRONTEND_URL.rstrip("/")
    link = (
        f"{frontend_url}/projects/{project_id}"
        if project_id
        else f"{frontend_url}/projects"
    )
    score_str = f" ({risk_score:.0f}/100)" if risk_score is not None else ""
    body = (
        f"[LADRIS ALERT] {risk_level}{score_str} Risk\n"
        f"Project: {project_name}\n"
        f"Delay: {predicted_delay}\n"
        f"Issue: {main_issue}\n"
        f"View: {link}"
    )
    return body


def send_alert_sms_sync(to_number: str, body: str) -> Dict[str, Any]:
    """
    Synchronously send SMS via Twilio. Falls back to graceful simulation
    when credentials are missing. Never raises an uncaught exception.
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    if not settings.SMS_ENABLED:
        logger.info("SMS notifications disabled via SMS_ENABLED=False")
        return {"sent": False, "mode": "DISABLED", "to": to_number, "timestamp": timestamp}

    # Simulation mode when credentials are blank
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_FROM_NUMBER:
        logger.info(
            f"[SMS NOTIFICATION DISPATCHED - Developer Mode] To: {to_number} | Body: {body[:80]}..."
        )
        return {
            "sent": True,
            "mode": "SIMULATED",
            "to": to_number,
            "timestamp": timestamp,
        }

    # Live Twilio dispatch
    try:
        from twilio.rest import Client  # type: ignore[import]
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=body,
            from_=settings.TWILIO_FROM_NUMBER,
            to=to_number,
        )
        logger.info(f"SMS delivered via Twilio to {to_number} (SID: {message.sid})")
        return {
            "sent": True,
            "mode": "TWILIO",
            "to": to_number,
            "sid": message.sid,
            "timestamp": timestamp,
        }
    except ImportError:
        logger.warning(
            "twilio package not installed. Run: pip install twilio. Falling back to simulation."
        )
        return {
            "sent": True,
            "mode": "SIMULATED",
            "to": to_number,
            "timestamp": timestamp,
        }
    except Exception as e:
        logger.warning(f"Failed to deliver Twilio SMS to {to_number}: {e}")
        return {
            "sent": False,
            "mode": "ERROR",
            "error": str(e),
            "to": to_number,
            "timestamp": timestamp,
        }


async def send_alert_sms_async(to_number: str, body: str) -> Dict[str, Any]:
    """Execute Twilio network call in a worker thread so it never blocks FastAPI."""
    return await asyncio.to_thread(send_alert_sms_sync, to_number, body)


async def resolve_officer_phone(
    db: AsyncSession,
    project_id: Optional[UUID] = None,
    state_code: Optional[str] = None,
) -> Optional[str]:
    """
    Resolves the officer phone number for a project.
    Priority: assigned officer > state officer > any active officer.
    Returns None if no phone number is registered.
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
                    if user.phone_number:
                        return user.phone_number

        if state_code:
            res = await db.execute(
                select(User).where(
                    User.is_active.is_(True),
                    User.state_code == state_code,
                    User.role.in_([UserRole.PROJECT_OFFICER, UserRole.LA_OFFICER, UserRole.DISTRICT_OFFICER]),
                    User.phone_number.isnot(None),
                ).limit(1)
            )
            matched_user = res.scalar_one_or_none()
            if matched_user and matched_user.phone_number:
                return matched_user.phone_number

        res = await db.execute(
            select(User).where(
                User.is_active.is_(True),
                User.role.in_([UserRole.PROJECT_OFFICER, UserRole.LA_OFFICER]),
                User.phone_number.isnot(None),
            ).limit(1)
        )
        officer = res.scalar_one_or_none()
        if officer and officer.phone_number:
            return officer.phone_number
    except Exception as e:
        logger.debug(f"Could not resolve officer phone from database: {e}")

    return None


async def log_notification(
    db: AsyncSession,
    alert_id: Any,
    channel: str,
    recipient: Optional[str],
    status: str,
    error_msg: Optional[str] = None,
) -> None:
    """Insert a NotificationLog row. Committed by the callers existing db.commit()."""
    try:
        log_entry = NotificationLog(
            alert_id=alert_id,
            channel=channel,
            recipient=recipient,
            status=status,
            error_msg=error_msg,
        )
        db.add(log_entry)
    except Exception as e:
        logger.debug(f"Could not write notification log entry: {e}")


async def trigger_alert_sms_if_needed(
    db: AsyncSession,
    alert: Any,
    project: Optional[Any] = None,
    current_risk_score: Optional[float] = None,
) -> bool:
    """
    Check SMS criteria, deduplicate, and asynchronously send SMS to the
    responsible officer when appropriate.
    Returns True if an SMS dispatch was initiated, False otherwise.

    Deduplication mirrors email_service.py:
      No re-send unless risk score increases by >=10 pts OR reminder interval elapsed.
    """
    from app.services.email_service import get_alert_settings

    config = get_alert_settings()

    # 1. SMS master toggle
    if not config.get("sms_notifications_enabled", False):
        return False

    # 2. Severity / score check
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

    if config.get("send_high_critical_only", True):
        if not is_high_or_crit:
            return False

    # 3. Deduplication
    already_sent = meta.get("sms_sent", False)
    last_sent_at_str = meta.get("sms_sent_at")
    last_sent_score = meta.get("sms_last_sent_risk_score")

    if already_sent:
        should_resend = False

        if score is not None and last_sent_score is not None:
            try:
                if (float(score) - float(last_sent_score)) >= 10.0:
                    should_resend = True
            except (ValueError, TypeError):
                pass

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

    # 4. Resolve phone number
    state_code = getattr(project, "state_code", None) or meta.get("state_code")
    to_number = await resolve_officer_phone(db, project_id=alert.project_id, state_code=state_code)

    if not to_number:
        logger.debug(f"No phone number for alert {alert.id} officer — SMS skipped.")
        return False

    # 5. Build 5-field SMS body
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
        pred_delay = "3-6 months (est.)"

    main_issue = getattr(alert, "title", None) or meta.get("alert_reason") or "High Delay Risk"

    body = format_alert_sms(
        project_name=pname,
        risk_level=risk_level,
        risk_score=score,
        predicted_delay=pred_delay,
        main_issue=main_issue,
        project_id=alert.project_id,
    )

    # 6. Background dispatch
    asyncio.create_task(send_alert_sms_async(to_number=to_number, body=body))

    # 7. Update alert metadata for deduplication
    updated_meta = dict(meta)
    updated_meta["sms_sent"] = True
    updated_meta["sms_sent_at"] = datetime.now(timezone.utc).isoformat()
    updated_meta["sms_recipient"] = to_number
    updated_meta["sms_status"] = "SENT"
    if score is not None:
        try:
            updated_meta["sms_last_sent_risk_score"] = float(score)
        except (ValueError, TypeError):
            pass
    alert.alert_metadata = updated_meta

    # 8. Persist notification log row
    await log_notification(db, alert_id=alert.id, channel="sms", recipient=to_number, status="SENT")

    return True
