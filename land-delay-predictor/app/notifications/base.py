"""
Notification provider interface. Each provider implements send_alert().
"""
from abc import ABC, abstractmethod
from typing import Any


class NotificationProvider(ABC):
    @abstractmethod
    def send_alert(self, alert: dict[str, Any]) -> bool:
        """Send an alert. Returns True on success."""
        ...
