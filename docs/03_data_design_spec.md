<!-- 목적: "어떤 지식(Data)을 가르칠 것인가?"를 정하는 교과서 목록
수집할 PDF 목록 (근로기준법, 시행령, 판례 등).
PDF를 몇 글자씩 자를 것인가? (Chunking 전략).
회원 정보 테이블에는 어떤 항목(ID, 닉네임, 업종 등)이 들어가는가?
설계 포인트: 우리 서비스의 핵심인 **'정확도'**를 결정짓는 상세 데이터 설계서 -->

# 📊 03. 데이터 및 RAG 상세 설계 (Data & RAG Spec)

본 문서는 Legal-Mind-RAG 서비스의 정확도를 결정짓는 지식베이스 전처리 전략과 이를 저장할 데이터베이스 구조를 상세히 정의합니다.

---

## 1. RAG 지식베이스 (Knowledge Base)
AI가 답변의 근거로 삼을 핵심 문서 목록 및 처리 전략입니다.

### ① 수집 대상 문서 (Internal Data)
- **근로기준법/시행령**: 모든 노무 상담의 기본이 되는 법령 (PDF).
- **남녀고용평등법**: 임신, 출산, 육아휴직 관련 핵심 법령 (PDF).
- **2024~2026 고용노동부 가이드라인**: 실무 지침서 (임금체불 예방, 직장 내 괴롭힘 등).
- **주요 판례집**: 대법원 및 노동위원회 핵심 판결 요약본.

### ② 데이터 전처리 (Chunking Strategy)
- **분할 단위**: 약 500~1,000자 내외 (문단 및 조항 단위 분할).
- **중첩(Overlap)**: 이전 문단의 끝부분 100자 정도를 다음 문단에 포함하여 맥락 유지.
- **메타데이터**: 각 조각에 `document_id`, `hierarchy_id`, `페이지 번호`, `조항 번호`를 태깅하여 답변 시 출처 표기.

### ③ 벡터 DB (Vector Store) 구성
- **엔진**: PostgreSQL (`pgvector` 익스텐션 활용)
- **임베딩 모델**: OpenAI `text-embedding-3-small`
- **검색 방식**: 유사도 기반 검색 (Cosine Similarity) + MMR (다양성 확보)

---

## 🏛️ 2. 데이터베이스 상세 정의 (DB Schema)

### ① 전체 ERD 설계도
본 프로젝트의 데이터 관계망입니다. (수정 시 `dbdiagram.io` 활용)

![Legal-Mind-RAG ERD](../images/Legal-Mind-RAG-ERD.png)

---



# 📊 03. 데이터 및 RAG 상세 설계 (Data & RAG Spec)

본 문서는 Legal-Mind-RAG 서비스의 정확도를 결정짓는 지식베이스 전처리 전략과 실제 ERD(dbdiagram.io) 설계와 100% 일치하는 데이터베이스 구조를 상세히 정의합니다.

---

## 1. RAG 지식베이스 (Knowledge Base)
AI가 답변의 근거로 삼을 핵심 문서 목록 및 처리 전략입니다.

### ① 수집 대상 문서 (Internal Data)
- **근로기준법/시행령**: 모든 노무 상담의 기본이 되는 법령 (PDF).
- **남녀고용평등법**: 임신, 출산, 육아휴직 관련 핵심 법령 (PDF).
- **2024~2026 고용노동부 가이드라인**: 실무 지침서 (임금체불 예방, 직장 내 괴롭힘 등).
- **주요 판례집**: 대법원 및 노동위원회 핵심 판결 요약본.

### ② 데이터 전처리 (Chunking Strategy)
- **분할 단위**: 약 500~1,000자 내외 (의미가 끊기지 않도록 문단 단위 분할).
- **중첩(Overlap)**: 이전 문단의 끝부분 100자 정도를 다음 문단에 포함하여 맥락 유지.
- **메타데이터**: 각 조각에 `파일명`, `페이지 번호`, `조항 번호`를 태깅하여 답변 시 출처 표기.

---

## 🏛️ 2. 데이터베이스 상세 정의서 (DB Schema)
*실제 ERD 설계와 100% 일치하며, 실제 구현될 DB 구조입니다.*

### 👤 2-1. USER DOMAIN (사용자 및 기업 관리)

#### [Users] 사용자 기본 정보
| 구분 | 컬럼명 | 역할 | 타입/옵션 | 출처 |
| :--- | :--- | :--- | :--- | :--- |
| **PK** | user_id | 사용자 고유 식별자 | UUID, NOT NULL | 시스템 |
| **UQ** | email | 로그인용 이메일 | VARCHAR, NOT NULL | 사용자 |
| **-** | password_hash | 암호화된 비밀번호 | VARCHAR, NOT NULL | 시스템 |
| **-** | nickname | 서비스 내 활동명 | VARCHAR | 사용자 |
| **ENUM**| emp_count_type | 상시 근로자 수 규모 | emp_count_enum | 사용자 |
| **-** | region_code | 법정동 코드 (10자리) | CHAR(10), 주석 참조 | 시스템 |
| **-** | is_active | 계정 활성화 여부 | BOOLEAN, Default: True | 시스템 |
| **-** | last_login_at | 최종 로그인 일시 | TIMESTAMP | 시스템 |
| **-** | created_at | 계정 생성 일시 | TIMESTAMP | 시스템 |
| **-** | updated_at | 정보 수정 일시 | TIMESTAMP | 시스템 |

#### [UserProfile, Companies, UserLifecycle]
| 테이블 | 역할 | 핵심 컬럼 |
| :--- | :--- | :--- |
| **UserProfile** | 산업군 및 소속 회사 관리 | `industry`, `company_id` (FK) |
| **Companies** | 기업 환경 정보 | `sector`, `has_labor_union`, `is_venture` |
| **UserLifecycle** | 임신/출산/육아 상태 추적 | `status` (ENUM), `start_date`, `end_date` |

---

### 💬 2-2. CONSULTATION DOMAIN (상담 및 추적 관리)

#### [ChatSession] 채팅 세션
| 구분 | 컬럼명 | 역할 | 타입/옵션 | 출처 |
| :--- | :--- | :--- | :--- | :--- |
| **PK** | chat_session_id | 세션 식별자 | UUID, NOT NULL | 시스템 |
| **FK** | user_id | 사용자 ID | UUID, Ref: Users | 시스템 |
| **-** | title | 상담 제목 | VARCHAR | AI 요약 |
| **-** | category | 상담 카테고리 | VARCHAR | AI 분류 |
| **-** | risk_level | 리스크 등급 | VARCHAR | AI 판단 |
| **-** | summary | 전체 대화 요약 | TEXT | AI 요약 |
| **-** | is_deleted | 삭제 여부 | BOOLEAN | 사용자 |

#### [Message] 개별 메시지
| 구분 | 컬럼명 | 역할 | 타입/옵션 | 출처 |
| :--- | :--- | :--- | :--- | :--- |
| **PK** | message_id | 메시지 식별자 | SERIAL, NOT NULL | 시스템 |
| **FK** | chat_session_id | 소속 세션 ID | UUID, Ref: ChatSessions | 시스템 |
| **-** | message_index | 세션 내 순서 | INT | 시스템 |
| **-** | role | 발화 주체(user/ai/system) | VARCHAR | 시스템 |
| **-** | content | 메시지 내용 | TEXT, NOT NULL | 사용자/AI |
| **-** | token_usage | 토큰 사용량 | INT | 시스템 |
| **FK** | parent_message_id | 부모 메시지 ID | INT, Self-Ref | 시스템 |

#### [AnswerMeta & AnswerTrace]
- **역할**: AI 답변의 신뢰도와 법적 근거(RAG)를 추적합니다.
- **핵심 컬럼**: `disclaimer`, `applied_rule`, `logic_type`, `relevance_score`.

---

### 📚 2-3. KNOWLEDGE BASE & EXTENSIONS

#### [Document & DocHierarchy & DocumentChunk]
- **역할**: 법령 계층 구조(`level`)와 벡터 검색용 조각(`embedding_vector`) 관리.

#### [Notification, BM, Report, Auth]
- **Notification**: 알림 및 수신 상태(`is_read`) 관리.
- **Partners/Lead**: 전문가 정보 및 비즈니스 전환(`status`) 추적.
- **Report/File**: 리포트 이력 및 사용자 업로드 파일 관리.
- **AuthProvider**: 소셜 로그인(`provider`, `provider_user_id`) 연동.

---

## 3. 벡터 DB (Vector Store) 구성
- **엔진**: PostgreSQL (`pgvector` 익스텐션 활용)
- **임베딩 모델**: OpenAI `text-embedding-3-small`
- **검색 방식**: 유사도 기반 검색 (Similarity Search) + MMR (다양성 확보)

---

## 🏛️ 4. 도메인별 상세 명세 및 비즈니스 로직 (상세 비고)

*본 섹션은 실제 DB 모델링(SQLAlchemy) 시 참고할 상세 가이드라인입니다.*

### 👤 4-1. USER DOMAIN (사용자 및 기업 관리)

| 구분 | 테이블 | 컬럼명 | 역할 | 타입/옵션 | 비고 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PK** | **users** | `user_id` | 사용자 식별자 | UUID, NN | 보안을 위한 고유 키 (ID 유추 방지) |
| **UQ** | | `email` | 로그인 계정 | VARCHAR, NN | 중복 가입 방지용 고유 이메일 |
| **ENUM**| | `emp_count_type` | 근로자 규모 | enum | **5인 미만 사업장 판단** (법 적용 핵심 기준) |
| **FK** | **user_profiles**| `user_id` | 사용자 연결 | UUID, NN | `users` 테이블과 1:1 관계 형성 |
| **FK** | | `company_id` | 기업 연결 | UUID | 사용자가 속한 기업 정보와 연결 |
| **PK** | **companies** | `company_id` | 기업 식별자 | UUID, NN | 기업별 노무 환경(업종, 노조유무) 관리 |
| **PK** | **user_lifecycles**| `lifecycle_id`| 상태 식별자 | SERIAL, NN | 시계열적 노무 상태 관리 |
| **ENUM**| | `status` | 현재 상태 | enum, NN | 임신, 출산, 육아 중인 상태 구분 |

### 💬 4-2. CONSULTATION DOMAIN (상담 기록 및 추적)

| 구분 | 테이블 | 컬럼명 | 역할 | 타입/옵션 | 비고 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PK** | **chat_sessions**| `chat_session_id`| 세션 식별자 | UUID, NN | 하나의 채팅방(상담 주제) 단위 |
| **-** | | `risk_level` | 위험 등급 | VARCHAR | AI가 요약한 법적 분쟁 위험도 |
| **PK** | **messages** | `message_id` | 메시지 식별자 | SERIAL, NN | 개별 발화 기록 (순서 보장) |
| **FK** | | `chat_session_id`| 세션 연결 | UUID, NN | 어느 대화방에 속한 메시지인지 구분 |
| **FK** | | `parent_message_id`| 부모 메시지 | INT | 대화의 계층 구조 및 맥락 연결 (Self-Ref) |
| **PK** | **answer_metas** | `meta_id` | 답변 메타 ID | SERIAL, NN | 면책공고 및 참고 법규 텍스트 저장 |
| **PK** | **answer_traces** | `trace_id` | RAG 추적 ID | SERIAL, NN | **검색된 조각(Chunk)과의 연관성 점수** 기록 |

### 📚 4-3. KNOWLEDGE BASE & EXTENSIONS

| 구분 | 테이블 | 컬럼명 | 역할 | 타입/옵션 | 비고 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PK** | **documents** | `document_id` | 원본 문서 ID | SERIAL, NN | 수집된 법령 PDF 등 원본 소스 관리 |
| **PK** | **doc_hierarchies**| `hierarchy_id` | 계층 구조 ID | SERIAL, NN | 편-장-절-조-항의 법률 구조화 관리 |
| **PK** | **document_chunks**| `chunk_id` | 검색 조각 ID | SERIAL, NN | 벡터 검색을 위해 쪼개진 텍스트 단위 |
| **-** | | `embedding_vector`| 벡터 데이터 | VECTOR | AI 연산을 위한 수치형 임베딩 값 |
| **PK** | **auth_providers**| `auth_id` | 소셜 인증 ID | SERIAL, NN | 카카오/구글 로그인을 위한 연동 관리 |
| **PK** | **user_notifications**| `user_notif_id` | 알림 식별자 | SERIAL, NN | 라이프사이클에 맞춘 개인 알림 발송 기록 |