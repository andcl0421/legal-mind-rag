from app.database.session import SessionLocal
from app.models import ChatSession, Message, AnswerMeta, AnswerTrace

db = SessionLocal()
try:
    print('chat_sessions=', db.query(ChatSession).count())
    print('messages=', db.query(Message).count())
    print('answer_metas=', db.query(AnswerMeta).count())
    print('answer_traces=', db.query(AnswerTrace).count())
finally:
    db.close()
