import json
from pathlib import Path

path = Path('scripts/sqlite_schema_dump.json')
raw = path.read_bytes()

# Heuristic: PowerShell redirection often emits UTF-16LE with BOM.
text = None
if raw.startswith(b'\xff\xfe') or raw.startswith(b'\xfe\xff'):
    text = raw.decode('utf-16')
else:
    text = raw.decode('utf-8')

dump = json.loads(text)

lines: list[str] = []
for table in dump['tables']:
    lines.append(f"\n# {table}")
    for col in dump['schema'][table]['columns']:
        flags = []
        if col['pk']:
            flags.append('PK')
        if col['notnull']:
            flags.append('NOT NULL')
        default = '' if col['default'] is None else f" DEFAULT {col['default']}"
        flag_text = (" " + " ".join(flags)) if flags else ""
        lines.append(f"- {col['name']} {col['type']}{flag_text}{default}")

    fks = dump['schema'][table]['foreign_keys']
    if fks:
        lines.append('  FKs:')
        for fk in fks:
            lines.append(
                f"  - {fk['from']} -> {fk['table']}.{fk['to']} (on_delete={fk['on_delete']}, on_update={fk['on_update']})"
            )

    idxs = dump['schema'][table]['indexes']
    if idxs:
        lines.append('  Indexes:')
        for idx in idxs:
            uniq = 'UNIQUE ' if idx['unique'] else ''
            cols = ','.join(idx['columns'])
            lines.append(f"  - {uniq}{idx['name']} ({cols})")

Path('scripts/sqlite_schema_pretty.txt').write_text('\n'.join(lines).lstrip() + '\n', encoding='utf-8')
print('wrote scripts/sqlite_schema_pretty.txt')
