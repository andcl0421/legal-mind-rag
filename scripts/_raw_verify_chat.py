from app.database.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    for table in ['chat_sessions', 'messages', 'answer_metas', 'answer_traces']:
        count = conn.execute(text(f'select count(*) from {table}')).scalar()
        print(table, count)
    rows = conn.execute(text('select chat_session_id, title, category, risk_level from chat_sessions order by created_at desc limit 3')).fetchall()
    print('latest_sessions=', rows)
