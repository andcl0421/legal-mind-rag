from app.services.knowledge_base import KnowledgeChunk, _score_first_pass, _score_rerank

question = '근로기준법 제43조 임금 지급 원칙이 궁금합니다'
question_tokens = {'근로기준법', '제43조', '임금', '지급', '원칙', '궁금합니다'}
query_vector = [0.0]

chunks = [
    KnowledgeChunk(
        chunk_id=1,
        category='임금/수당',
        title='근로기준법',
        rule_label='임금 지급 원칙',
        content='제43조(임금 지급) 임금은 통화로 직접 근로자에게 그 전액을 지급하여야 한다.',
        source_file='a.pdf',
        source_type='raw',
        article_number='제43조',
    ),
    KnowledgeChunk(
        chunk_id=2,
        category='임금/수당',
        title='근로기준법',
        rule_label='임금 일반 원칙',
        content='임금 전반에 관한 일반 설명이다.',
        source_file='b.pdf',
        source_type='raw',
        article_number='제40조',
    ),
]

for chunk in chunks:
    first_pass, _ = _score_first_pass(question, question_tokens, query_vector, chunk)
    rerank = _score_rerank(question, question_tokens, chunk)
    final_score = (first_pass * 0.55) + (rerank * 0.45)
    print(chunk.chunk_id, round(first_pass, 2), round(rerank, 2), round(final_score, 2))
