from collections import Counter
from app.database.session import SessionLocal
from app.models import Document, DocumentChunk, DocumentChunkEmbedding
from app.services.knowledge_base import load_knowledge_base, refresh_knowledge_base_cache

refresh_knowledge_base_cache()
kb = load_knowledge_base()
print('kb_total=', len(kb))
print('kb_source_type=', dict(Counter(chunk.source_type for chunk in kb)))
print('kb_non_pdf=', sum(1 for chunk in kb if not chunk.source_file.lower().endswith('.pdf')))
print('kb_pdf=', sum(1 for chunk in kb if chunk.source_file.lower().endswith('.pdf')))

db = SessionLocal()
try:
    print('documents=', db.query(Document).count())
    print('chunks=', db.query(DocumentChunk).count())
    print('embeddings=', db.query(DocumentChunkEmbedding).count())
    print('document_sources=', [doc.source_file for doc in db.query(Document).order_by(Document.document_id.asc()).all()])
finally:
    db.close()
