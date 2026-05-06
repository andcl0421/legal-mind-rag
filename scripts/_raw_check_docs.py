from app.database.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    tables = conn.execute(text("select table_name from information_schema.tables where table_schema='public' and table_name in ('documents','document_chunks','document_chunk_embeddings') order by table_name")).fetchall()
    print('tables=', [row[0] for row in tables])
    for table in ['documents', 'document_chunks', 'document_chunk_embeddings']:
        exists = conn.execute(text("select exists (select 1 from information_schema.tables where table_schema='public' and table_name=:table)"), {'table': table}).scalar()
        if not exists:
            print(table, 'missing')
            continue
        cols = conn.execute(text("select column_name from information_schema.columns where table_schema='public' and table_name=:table order by ordinal_position"), {'table': table}).fetchall()
        count = conn.execute(text(f'select count(*) from {table}')).scalar()
        print(table, 'cols=', [c[0] for c in cols], 'count=', count)
