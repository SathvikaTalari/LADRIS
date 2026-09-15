"""
Push notification provider (Firebase Cloud Messaging).
Configuration via environment variables:
  FCM_SERVER_KEY, FCM_DEVICE_TOKEN
"""
from __future__ import annotations

import os

from app.notifications.base import NotificationProvider


class PushNotification(NotificationProvider):
    def __init__(self):
        self.server_key = os.environ.get("FCM_SERVER_KEY", "")
        self.device_token = os.environ.get("FCM_DEVICE_TOKEN", "")

    def send_alert(self, alert: dict) -> bool:
        if not self.server_key or not self.device_token:
            print("FCM not configured")
            return False

        try:
            import requests
            headers = {
                "Authorization": f"key={self.server_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "to": self.device_token,
                "notification": {
                    "title": alert.get("title", "Land Acquisition Alert"),
                    "body": alert.get("message", ""),
                },
            }
            resp = requests.post(
                "https://fcm.googleapis.com/fcm/send",
                headers=headers,
                json=payload,
                timeout=30,
            )
            return resp.status_code == 200
        except Exception as e:
            print(f"Push send failed: {e}")
            return False
