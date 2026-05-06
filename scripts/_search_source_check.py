from app.services.knowledge_base import search_knowledge, refresh_knowledge_base_cache

queries = [
    '주휴수당을 받을 수 있는 조건이 뭔가요?',
    '실업급여는 자발적 퇴사면 무조건 못 받나요?',
    '제품 요구사항 문서에 있는 MVP 범위가 뭐야?'
]

refresh_knowledge_base_cache()
for query in queries:
    print('QUERY=', query)
    for idx, (chunk, score) in enumerate(search_knowledge(query, top_k=3), start=1):
        print(idx, score, chunk.source_type, chunk.source_file, chunk.title)
    print('-' * 40)
