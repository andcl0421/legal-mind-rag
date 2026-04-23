from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database.session import Base


class DocumentChunkEmbedding(Base):
    __tablename__ = "document_chunk_embeddings"

    chunk_id = Column(Integer, ForeignKey("document_chunks.chunk_id"), primary_key=True)
    model_name = Column(String, nullable=False)
    vector_json = Column(Text, nullable=False)

    chunk = relationship("DocumentChunk", back_populates="embedding")
