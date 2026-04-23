import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.session import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    chat_session_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.user_id"), nullable=True)
    title = Column(String, nullable=True)
    category = Column(String, nullable=True)
    risk_level = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")
    user = relationship("User", back_populates="chat_sessions")


class Message(Base):
    __tablename__ = "messages"

    message_id = Column(Integer, primary_key=True, autoincrement=True)
    chat_session_id = Column(Uuid, ForeignKey("chat_sessions.chat_session_id"), nullable=False)
    message_index = Column(Integer, nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    token_usage = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    parent_message_id = Column(Integer, ForeignKey("messages.message_id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship("ChatSession", back_populates="messages")
    answer_meta = relationship("AnswerMeta", back_populates="message", uselist=False)
    answer_traces = relationship("AnswerTrace", back_populates="message")
    parent_message = relationship("Message", remote_side=[message_id])


class AnswerMeta(Base):
    __tablename__ = "answer_metas"

    meta_id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("messages.message_id"), nullable=False)
    disclaimer = Column(Text, nullable=True)
    applied_rule = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    message = relationship("Message", back_populates="answer_meta")


class AnswerTrace(Base):
    __tablename__ = "answer_traces"

    trace_id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("messages.message_id"), nullable=False)
    chunk_id = Column(Integer, nullable=True)
    step_order = Column(Integer, nullable=True)
    logic_type = Column(String, nullable=True)
    relevance_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    message = relationship("Message", back_populates="answer_traces")
