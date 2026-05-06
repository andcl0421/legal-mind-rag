import sqlite3
con = sqlite3.connect('sql_app.db')
cur = con.cursor()
cur.execute("select name from sqlite_master where type='table' order by name")
for (name,) in cur.fetchall():
    print(name)
