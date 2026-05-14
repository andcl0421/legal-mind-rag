from datetime import datetime

from pydantic import BaseModel, Field


class ChecklistItemUpsertRequest(BaseModel):
    chat_session_id: str = Field(..., min_length=1)
    item_type: str = Field(..., pattern="^(next_action|required_doc)$")
    item_text: str = Field(..., min_length=1, max_length=500)
    is_done: bool


class ChecklistItemResponse(BaseModel):
    checklist_item_id: int
    chat_session_id: str
    item_type: str
    item_text: str
    is_done: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ChecklistItemListResponse(BaseModel):
    items: list[ChecklistItemResponse]
