from datetime import datetime

from pydantic import BaseModel, Field


class EvidenceFileResponse(BaseModel):
    user_file_id: int
    original_filename: str
    mime_type: str
    file_size: int
    description: str | None = None
    category: str | None = None
    chat_session_id: str | None = None
    created_at: datetime | None = None


class EvidenceListResponse(BaseModel):
    items: list[EvidenceFileResponse]
