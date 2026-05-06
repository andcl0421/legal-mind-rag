import json
import sqlite3

DB_PATH = 'sql_app.db'

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

cur.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name")
tables = [r[0] for r in cur.fetchall()]

out = {}
for t in tables:
    cur.execute(f"pragma table_info('{t}')")
    cols = cur.fetchall()  # cid, name, type, notnull, dflt_value, pk

    cur.execute(f"pragma foreign_key_list('{t}')")
    fks = cur.fetchall()

    cur.execute(f"pragma index_list('{t}')")
    idxs = cur.fetchall()  # seq, name, unique, origin, partial

    idx_detail = []
    for (_seq, idx_name, unique, origin, partial) in idxs:
        cur.execute(f"pragma index_info('{idx_name}')")
        idx_cols = cur.fetchall()  # seqno, cid, name
        cur.execute("select sql from sqlite_master where type='index' and name=?", (idx_name,))
        sql_row = cur.fetchone()
        idx_detail.append({
            'name': idx_name,
            'unique': bool(unique),
            'origin': origin,
            'partial': bool(partial),
            'columns': [c[2] for c in idx_cols],
            'sql': sql_row[0] if sql_row else None,
        })

    cur.execute("select sql from sqlite_master where type='table' and name=?", (t,))
    create_sql = cur.fetchone()

    out[t] = {
        'columns': [
            {
                'cid': c[0],
                'name': c[1],
                'type': c[2],
                'notnull': bool(c[3]),
                'default': c[4],
                'pk': bool(c[5]),
            }
            for c in cols
        ],
        'foreign_keys': [
            {
                'id': fk[0],
                'seq': fk[1],
                'table': fk[2],
                'from': fk[3],
                'to': fk[4],
                'on_update': fk[5],
                'on_delete': fk[6],
                'match': fk[7],
            }
            for fk in fks
        ],
        'indexes': idx_detail,
        'create_table_sql': create_sql[0] if create_sql else None,
    }

print(json.dumps({'db_path': DB_PATH, 'tables': tables, 'schema': out}, ensure_ascii=False, indent=2))
