<!-- 02_system_architecture.md (시스템 아키텍처)
목적: "어떻게(How) 연결할 것인가?"를 정하는 기술 지도
사용자가 접속하면 FastAPI가 받고, 그 질문을 LangChain이 처리해서 OpenAI로 보낸다.
로그인 정보는 어떤 데이터베이스에 저장한다.
프론트엔드와 백엔드는 어떤 방식으로 대화한다.
설계 포인트: 전체 시스템의 **'흐름도(Flow)'**를 설계합니다. 나중에 개발하다가 길을 잃지 않게 해주는 지도 역할 -->

# 🗺️ 02. 시스템 아키텍처 (System Architecture)

## 1. 전체 서비스 흐름 (High-Level Flow)
사용자의 요청이 들어와서 답변이 나가기까지의 3단계 흐름입니다.

1. **User Request**: 사용자가 프론트엔드(React)에서 질문 입력.
2. **Backend Processing**: FastAPI가 질문을 받아 '개인정보 마스킹' 후 RAG 엔진으로 전달.
3. **AI Reasoning**: 
   - 질문과 관련된 법령 조항을 Vector DB(ChromaDB)에서 검색.
   - 검색된 법 조항 + 사용자 정보(업종 등)를 OpenAI GPT-4o에 전달.
   - 근거가 명시된 답변 생성 후 사용자에게 반환.

## 2. 계층별 상세 역할 (Layered Architecture)

### [A] Client Layer (Frontend)
- **기술**: React + Tailwind CSS
- **역할**: 채팅 UI 제공, 실시간 알림 수신, 계산기 위젯 렌더링.

### [B] API & Logic Layer (Backend)
- **기술**: FastAPI + LangChain
- **핵심 모듈**:
  - **Router**: API 경로 관리 (질문 접수, 로그인 처리).
  - **Auth Service**: JWT 기반 보안 토큰 발급 및 로그인 검증.
  - **RAG Engine**: PDF 텍스트 추출, 벡터화, 유사도 검색 실행.
  - **Task Scheduler**: 공공데이터 API를 주기적으로 체크하여 노무 이슈 알림 생성.

### [C] Data Layer (Database)
- **Vector DB (ChromaDB)**: 법령 및 판례 PDF를 '의미 단위'로 수치화하여 저장.
- **RDBMS (SQLite/PostgreSQL)**: 사용자 프로필, 채팅 이력, 알림 설정 저장.
- **File Storage**: 원본 PDF 가이드라인 보관.

## 3. 데이터 흐름도 (Data Flow Diagram)
1. **질문 유입** -> 2. **사용자 정보 매칭** (5인 미만 등) -> 3. **관련 법령 검색** -> 4. **AI 답변 생성** -> 5. **출처(Source) 부착** -> 6. **최종 응답**