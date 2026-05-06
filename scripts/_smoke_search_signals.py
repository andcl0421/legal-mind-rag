from app.services.knowledge_base import KnowledgeChunk, _score_legal_query_signals

chunk = KnowledgeChunk(
    chunk_id=1,
    category='임금/수당',
    title='근로기준법',
    rule_label='임금 지급 원칙',
    content='제43조(임금 지급) 임금은 통화로 직접 근로자에게 그 전액을 지급하여야 한다.',
    source_file='sample.pdf',
    source_type='raw',
    article_number='제43조',
    page_number=5,
)

questions = [
    '근로기준법 제43조가 뭐예요?',
    '임금 지급 원칙이 궁금합니다',
    '체불 임금 관련해서 알려주세요',
]

for question in questions:
    print(question)
    print(round(_score_legal_query_signals(question, chunk), 2))
