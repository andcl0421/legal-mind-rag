from app.database.session import engine
from sqlalchemy import text

for table in ['users','documents','document_chunks']:
    with engine.connect() as conn:
        rows = conn.execute(text("select column_name, data_type from information_schema.columns where table_schema='public' and table_name=:table order by ordinal_position"), {'table': table}).fetchall()
        print(table, rows)
