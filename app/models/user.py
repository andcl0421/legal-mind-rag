import uuid

from sqlalchemy import Boolean, Column, DateTime, String, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.session import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    nickname = Column(String, nullable=True)
    emp_count_type = Column(String, nullable=False)
    region_code = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    chat_sessions = relationship("ChatSession", back_populates="user")
