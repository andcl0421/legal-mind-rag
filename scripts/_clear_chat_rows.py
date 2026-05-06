from app.database.session import engine
from sqlalchemy import text

with engine.begin() as conn:
    conn.execute(text('DELETE FROM answer_traces'))
    conn.execute(text('DELETE FROM answer_metas'))
    conn.execute(text('DELETE FROM messages'))
    conn.execute(text('DELETE FROM chat_sessions'))
print('cleared')
