# 기술 아키텍처 + API 명세 요약

## 1. 아키텍처 개요
- Frontend: React + Tailwind
- Backend: FastAPI + SQLAlchemy + JWT
- AI: RAG 검색 + OpenAI LLM 응답 생성
- DB: SQLite (개발 기준)

## 2. 처리 흐름
1. 프론트에서 상담 요청
2. 백엔드에서 사용자 컨텍스트/세션/첨부 증거 결합
3. RAG 검색으로 관련 청크 조회
4. LLM 응답 생성 및 구조화
5. 상담/알림/체크리스트/추적 정보 저장
6. 프론트에 답변/근거/상태 반환

## 3. 인증 방식
- 로그인 시 JWT 발급
- 보호 API는 `Authorization: Bearer <token>` 필수

## 4. 주요 API

### Chat
- `POST /api/v1/chat`
  - 입력: `content`, `chat_session_id`, `company_size`, `employment_type`, `evidence_file_ids` 등
  - 출력: 답변 메시지, 근거, 세션 정보
- `GET /api/v1/chat`
- `GET /api/v1/chat/{chat_session_id}`
- `DELETE /api/v1/chat/{chat_session_id}`

### Alerts
- `GET /api/v1/alerts?unread_only=&source=&chat_session_id=`
- `POST /api/v1/alerts`
- `PATCH /api/v1/alerts/{id}/read`

### Evidence
- `POST /api/v1/evidence`
- `GET /api/v1/evidence?category=&chat_session_id=`
- `GET /api/v1/evidence/{id}/download`
- `DELETE /api/v1/evidence/{id}`

### Checklist
- `GET /api/v1/checklist?chat_session_id=...`
- `POST /api/v1/checklist` (upsert: 체크 상태 저장)

