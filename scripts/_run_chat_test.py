from app.database.session import SessionLocal
from app.services.chat_service import process_chat_message

question = '해고예고 없이 바로 해고할 수 있나요?'

db = SessionLocal()
try:
    response = process_chat_message(db=db, content=question)
    print('chat_session_id=', response.chat_session_id)
    print('category=', response.category)
    print('risk_level=', response.risk_level)
    print('primary_citation=', response.structured_answer.primary_citation)
    print('cited_rules=', response.structured_answer.cited_rules)
    print('answer_sections=', [(section.heading, section.citation) for section in response.structured_answer.answer_sections])
    print('trace_count=', len(response.answer_traces))
    print('trace_preview=', [(trace.chunk_id, trace.citation, trace.source_label) for trace in response.answer_traces])
except Exception as exc:
    print('error=', exc.__class__.__name__, str(exc))
finally:
    db.close()
