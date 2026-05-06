from app.database.session import engine
from sqlalchemy import text

queries = {
    'chat_sessions': "select column_name from information_schema.columns where table_schema='public' and table_name='chat_sessions' order by ordinal_position",
    'messages': "select column_name from information_schema.columns where table_schema='public' and table_name='messages' order by ordinal_position",
    'answer_metas': "select column_name from information_schema.columns where table_schema='public' and table_name='answer_metas' order by ordinal_position",
    'answer_traces': "select column_name from information_schema.columns where table_schema='public' and table_name='answer_traces' order by ordinal_position",
}
with engine.connect() as conn:
    for name, query in queries.items():
        rows = conn.execute(text(query)).fetchall()
        print(name, [row[0] for row in rows])
