from app.database.session import SessionLocal
from app.models import Message

db = SessionLocal()
try:
    messages = db.query(Message).order_by(Message.message_index.asc()).all()
    for message in messages:
        print(message.role, message.message_index, message.content[:200].replace('\n', ' | '))
finally:
    db.close()
