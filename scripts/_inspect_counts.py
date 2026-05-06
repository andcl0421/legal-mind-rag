from app.database.session import engine
from sqlalchemy import text

tables = ['users','chat_sessions','messages','answer_metas','answer_traces','documents','document_chunks','document_chunk_embeddings','companies','doc_hierarchies','user_lifecycles','user_profiles']
with engine.connect() as conn:
    for table in tables:
        exists = conn.execute(text("select exists (select 1 from information_schema.tables where table_schema='public' and table_name=:table)"), {'table': table}).scalar()
        if not exists:
            print(f'{table}:missing')
            continue
        try:
            count = conn.execute(text(f'select count(*) from {table}')).scalar()
            print(f'{table}:{count}')
        except Exception as exc:
            print(f'{table}:error:{exc.__class__.__name__}')
