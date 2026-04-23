from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.database.session import Base, SessionLocal, engine
from app.models import AnswerMeta, AnswerTrace, ChatSession, Document, DocumentChunk, DocumentChunkEmbedding, Message, User
from app.services.document_ingestion import ingest_raw_documents, persist_processed_chunks_to_db
from app.services.knowledge_base import refresh_knowledge_base_cache


def main():
    Base.metadata.create_all(bind=engine)
    result = ingest_raw_documents()
    db = SessionLocal()
    try:
        persisted = persist_processed_chunks_to_db(db)
    finally:
        db.close()
    refresh_knowledge_base_cache()
    print({"file_ingest": result, "db_persist": persisted})


if __name__ == "__main__":
    main()
