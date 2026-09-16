"""
Notification dispatcher: routes alerts to configured channels.
Reads PROVIDER_* toggles from environment and sends alerts in parallel.
"""
from __future__ import annotations

import os
from typing import Any

from app.notifications.email_sender import EmailNotification
from app.notifications.sms_sender import SMSNotification
from app.notifications.push_sender import PushNotification


class NotificationDispatcher:
    def __init__(self):
        self.providers = []
        if os.environ.get("ENABLE_EMAIL", "true").lower() == "true":
            self.providers.append(EmailNotification())
        if os.environ.get("ENABLE_SMS", "false").lower() == "true":
            self.providers.append(SMSNotification())
        if os.environ.get("ENABLE_PUSH", "false").lower() == "true":
            self.providers.append(PushNotification())

    def dispatch(self, alert: dict[str, Any]) -> dict[str, bool]:
        results = {}
        for provider in self.providers:
            name = provider.__class__.__name__
            try:
                results[name] = provider.send_alert(alert)
            except Exception as e:
                results[name] = False
                print(f"{name} failed: {e}")
        return results
