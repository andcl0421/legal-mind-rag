from app.database.session import SessionLocal
from app.models import Document, DocumentChunk, DocumentChunkEmbedding

db = SessionLocal()
try:
    print('documents_count=', db.query(Document).count())
    print('chunks_count=', db.query(DocumentChunk).count())
    print('embeddings_count=', db.query(DocumentChunkEmbedding).count())
    first = db.query(Document).first()
    print('first_document=', None if first is None else {'id': first.document_id, 'title': first.title, 'source_file': first.source_file})
finally:
    db.close()
