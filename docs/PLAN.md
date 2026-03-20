#### **[PLAN.md 내용 초안]**

# 📑 Legal-Mind-RAG 프로젝트 실행 계획서

## 1. 프로젝트 개요
- **명칭:** Legal-Mind-RAG (지능형 노무/세무 상담 비서)
- **대상:** 법률 지식이 부족한 비전공자 및 일반인
- **목표:** RAG 기술을 활용해 정확한 법적 근거(조항, 페이지)를 제공하는 AI 서비스 구축

## 2. 단계별 마일스톤 (Milestone)
- **[Step 0] 기초 공사:** 폴더 구조 확립, `README.md` 및 `PLAN.md` 작성 (현재 진행 중)
- **[Step 1] 환경 세팅:** 가상환경 구축, `requirements.txt` 정의
- **[Step 2] 데이터 설계:** 근로기준법 가이드 PDF 수집 및 전처리(Chunking) 전략 수립
- **[Step 3] AI 로직 구현:** Vector DB 연결 및 RAG 체인(Retrieval-Augmented Generation) 구축
- **[Step 4] API 서버 개발:** FastAPI를 이용한 레이어드 아키텍처(Router-Service-Repo) 구현
- **[Step 5] 테스트 및 문서화:** 트러블슈팅 기록 및 최종 깃허브 정리

## 3. 오늘의 결정 사항 (2026-03-10)
- 프로젝트 명을 `Legal-Mind-RAG`로 확정함.
- 확장성을 고려하여 `app/` 하위에 계층형 구조를 적용하기로 함.