"""
Email notification provider using SMTP.
Configuration via environment variables:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
"""
from __future__ import annotations

import os
import smtplib
from email.mime.text import MIMEText

from app.notifications.base import NotificationProvider


class EmailNotification(NotificationProvider):
    def __init__(self):
        self.host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        self.port = int(os.environ.get("SMTP_PORT", "587"))
        self.user = os.environ.get("SMTP_USER", "")
        self.password = os.environ.get("SMTP_PASSWORD", "")
        self.from_addr = os.environ.get("SMTP_FROM", "alerts@land-delay.in")

    def send_alert(self, alert: dict) -> bool:
        msg = MIMEText(alert.get("message", ""))
        msg["Subject"] = alert.get("title", "Land Acquisition Alert")
        msg["From"] = self.from_addr
        msg["To"] = alert.get("email", os.environ.get("ADMIN_EMAIL", ""))

        try:
            with smtplib.SMTP(self.host, self.port) as server:
                server.starttls()
                server.login(self.user, self.password)
                server.sendmail(self.from_addr, [msg["To"]], msg.as_string())
            return True
        except Exception as e:
            print(f"Email send failed: {e}")
            return False
