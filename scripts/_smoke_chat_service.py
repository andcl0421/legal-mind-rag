from app.services.chat_service import _build_structured_answer
from app.services.knowledge_base import KnowledgeChunk

chunks = [(
    KnowledgeChunk(
        chunk_id=1,
        category='임금/수당',
        title='근로기준법',
        rule_label='근로기준법',
        content='제43조(임금 지급) 임금은 통화로 직접 근로자에게 그 전액을 지급하여야 한다.',
        source_file='sample.pdf',
        source_type='raw',
        article_number='제43조',
        page_number=12,
    ),
    0.92,
)]
structured_answer, applied_rule, confidence_score, answer_text = _build_structured_answer('임금이 늦게 들어왔어요', '임금/수당', chunks)
print(structured_answer.answer_sections[0].heading)
print(applied_rule)
print(confidence_score)
print('근거:' in answer_text)
