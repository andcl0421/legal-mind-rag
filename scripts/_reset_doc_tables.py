from app.database.session import engine
from sqlalchemy import text

sql = '''
DROP TABLE IF EXISTS document_chunk_embeddings CASCADE;
DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
'''
with engine.begin() as conn:
    conn.execute(text(sql))
print('dropped')
