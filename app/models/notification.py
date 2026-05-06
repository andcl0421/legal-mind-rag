from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.session import Base


class UserNotification(Base):
    __tablename__ = "user_notifications"

    user_notif_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Uuid, ForeignKey("users.user_id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
