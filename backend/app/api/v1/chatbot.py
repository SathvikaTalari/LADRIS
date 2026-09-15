"""
LADRIS — Chatbot API Router: Saarthi AI Assistant
POST /api/v1/chatbot/chat
GET  /api/v1/chatbot/suggestions
"""
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_optional
from app.models.user import User
from app.services.chatbot_service import saarthi_service

router = APIRouter(prefix="/chatbot", tags=["Saarthi Chatbot"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User question or prompt")
    history: Optional[List[ChatMessage]] = Field(default_factory=list)
    active_page: Optional[str] = None


class ActionItem(BaseModel):
    label: str
    path: str


class ChatResponse(BaseModel):
    reply: str
    actions: List[ActionItem] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    timestamp: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Process conversational query through Saarthi's domain and database intelligence engine.
    """
    user_role = current_user.role.value if current_user and hasattr(current_user, "role") else "VIEWER"

    result = await saarthi_service.process_query(
        query=payload.message,
        user_role=user_role,
        active_page=payload.active_page,
        db=db,
    )

    return ChatResponse(
        reply=result["reply"],
        actions=[ActionItem(**a) for a in result.get("actions", [])],
        suggestions=result.get("suggestions", []),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/suggestions", response_model=List[str])
async def get_suggestions(
    active_page: Optional[str] = None,
) -> List[str]:
    """Return contextual starter suggestions for Saarthi."""
    if active_page == "/gis":
        return [
            "How are verified coordinates mapped on GIS?",
            "Which projects have location unavailable?",
            "Show high-risk corridors on map",
        ]
    if active_page == "/priority-intelligence":
        return [
            "How is the Priority Score calculated?",
            "Which project has the highest delay months?",
            "Explain statutory lapse risk factor",
        ]
    if active_page == "/la-workbench":
        return [
            "What is Section 3D 1-year statutory rule?",
            "How does CALA handle Section 3C objections?",
            "Explain compensation disbursement formula",
        ]
    if active_page == "/intelligence":
        return [
            "How does the What-If simulation work?",
            "Can expedited budgets reduce corridor delays?",
            "Explain risk velocity forecasting",
        ]

    return [
        "Which projects have the highest delay risk?",
        "What is the Section 3D statutory 1-year rule?",
        "How is the Priority Score calculated?",
        "How do I use the GIS Risk Map?",
        "Tell me about legal disputes in land acquisition"
    ]
