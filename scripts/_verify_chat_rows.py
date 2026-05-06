from app.database.session import SessionLocal
from app.models import ChatSession, Message, AnswerMeta, AnswerTrace

db = SessionLocal()
try:
    print('chat_sessions=', db.query(ChatSession).count())
    print('messages=', db.query(Message).count())
    print('answer_metas=', db.query(AnswerMeta).count())
    print('answer_traces=', db.query(AnswerTrace).count())
    session = db.query(ChatSession).order_by(ChatSession.created_at.desc()).first()
    if session:
        print('latest_session=', str(session.chat_session_id), session.title, session.category, session.risk_level)
        messages = db.query(Message).filter(Message.chat_session_id == session.chat_session_id).order_by(Message.message_index.asc()).all()
        print('latest_messages=', [(m.message_index, m.role, m.message_id, m.parent_message_id) for m in messages])
        traces = db.query(AnswerTrace).join(Message, Message.message_id == AnswerTrace.message_id).filter(Message.chat_session_id == session.chat_session_id).order_by(AnswerTrace.step_order.asc()).all()
        print('latest_traces=', [(t.step_order, t.chunk_id, t.logic_type, t.relevance_score) for t in traces])
finally:
    db.close()
