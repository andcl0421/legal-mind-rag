from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database.session import Base


class Document(Base):
    __tablename__ = "documents"

    document_id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    source_file = Column(String, unique=True, nullable=False)
    category = Column(String, nullable=True)

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    chunk_id = Column(Integer, primary_key=True, autoincrement=False)
    document_id = Column(Integer, ForeignKey("documents.document_id"), nullable=False)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    article_number = Column(String, nullable=True)
    source_type = Column(String, nullable=False)
    category = Column(String, nullable=True)

    document = relationship("Document", back_populates="chunks")
    embedding = relationship("DocumentChunkEmbedding", back_populates="chunk", uselist=False, cascade="all, delete-orphan")
