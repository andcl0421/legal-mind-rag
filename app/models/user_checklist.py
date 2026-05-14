from sqlalchemy import Boolean, Column, DateTime, Integer, String, Uuid
from sqlalchemy.sql import func

from app.database.session import Base


class UserChecklistItem(Base):
    __tablename__ = "user_checklist_items"

    checklist_item_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Uuid, nullable=False, index=True)
    chat_session_id = Column(String, nullable=False, index=True)
    item_type = Column(String, nullable=False)  # next_action | required_doc
    item_text = Column(String, nullable=False)
    is_done = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
