"""
SMS notification provider (Twilio-compatible).
Configuration via environment variables:
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, ADMIN_PHONE
"""
from __future__ import annotations

import os

from app.notifications.base import NotificationProvider


class SMSNotification(NotificationProvider):
    def __init__(self):
        self.account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
        self.auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
        self.from_number = os.environ.get("TWILIO_FROM", "")
        self.to_number = os.environ.get("ADMIN_PHONE", "")

    def send_alert(self, alert: dict) -> bool:
        if not self.account_sid or not self.from_number:
            print("Twilio not configured")
            return False

        try:
            from twilio.rest import Client
            client = Client(self.account_sid, self.auth_token)
            message = client.messages.create(
                body=alert.get("message", ""),
                from_=self.from_number,
                to=alert.get("phone", self.to_number),
            )
            return message.sid is not None
        except Exception as e:
            print(f"SMS send failed: {e}")
            return False
