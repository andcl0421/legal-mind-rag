from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.sql import func

from app.database.session import Base


class UserFile(Base):
    __tablename__ = "user_files"

    user_file_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Uuid, nullable=False, index=True)
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False, unique=True)
    mime_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=True)
    chat_session_id = Column(Uuid, ForeignKey("chat_sessions.chat_session_id"), nullable=True, index=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
