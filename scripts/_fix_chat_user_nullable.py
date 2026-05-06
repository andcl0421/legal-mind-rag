from app.database.session import engine
from sqlalchemy import text

with engine.begin() as conn:
    conn.execute(text('ALTER TABLE chat_sessions ALTER COLUMN user_id DROP NOT NULL'))
print('altered')
