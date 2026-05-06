from app.database.session import engine
from sqlalchemy import text

queries = {
    'users': "select column_name from information_schema.columns where table_schema='public' and table_name='users' order by ordinal_position",
    'documents': "select column_name from information_schema.columns where table_schema='public' and table_name='documents' order by ordinal_position",
    'document_chunks': "select column_name from information_schema.columns where table_schema='public' and table_name='document_chunks' order by ordinal_position",
    'chat_sessions': "select column_name from information_schema.columns where table_schema='public' and table_name='chat_sessions' order by ordinal_position",
}
with engine.connect() as conn:
    for name, query in queries.items():
        rows = conn.execute(text(query)).fetchall()
        print(name, [row[0] for row in rows])
