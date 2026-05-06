from app.database.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    print('ping=', conn.execute(text('select 1')).scalar())
    tables = conn.execute(text("select table_name from information_schema.tables where table_schema='public' order by table_name")).fetchall()
    print('tables=', [row[0] for row in tables])
