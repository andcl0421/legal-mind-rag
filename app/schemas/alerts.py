from datetime import datetime

from pydantic import BaseModel, Field


class AlertCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    content: str = Field(..., min_length=1, max_length=2000)
    due_date: datetime | None = None


class AlertResponse(BaseModel):
    user_notif_id: int
    title: str
    content: str
    source: str = "manual"
    alert_type: str | None = None
    chat_session_id: str | None = None
    due_date: datetime | None = None
    is_read: bool
    created_at: datetime | None = None
    read_at: datetime | None = None


class AlertListResponse(BaseModel):
    items: list[AlertResponse]
