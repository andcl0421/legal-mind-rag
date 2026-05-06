from app.database.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    rows = conn.execute(text("select column_name, is_nullable from information_schema.columns where table_schema='public' and table_name='chat_sessions' order by ordinal_position")).fetchall()
    print(rows)
