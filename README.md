# ⚖️ Legal-Mind-RAG
> **근로자를 위한 지능형 노무 상담 비서**  
> "내 월급, 내 휴가, 내 아이를 위한 권리까지—AI가 최신 법령과 판례로 답변합니다."

---

## 📅 작성일
- 2026-03-10 (최종 수정: 2026-03-20)

---

## 🎯 1. 프로젝트 기획 의도
- **정보 비대칭 해소:** 복잡한 근로기준법을 근로자의 눈높이에서 해석하여 정당한 권리를 찾도록 돕습니다.
- **RAG 기반 신뢰성:** AI의 환각(Hallucination)을 방지하기 위해 반드시 **고용노동부 공식 가이드북 및 최신 판례**를 근거로 답변합니다.
- **균형 잡힌 전문성:** 임금, 근로시간, 해고뿐만 아니라 상대적으로 정보가 부족한 **임신·출산·육아 관련 노무 지식**을 동등한 비중으로 다룹니다.

---

## 🏗️ 2. 시스템 설계 핵심 (Business Logic)

### ⚖️ 4대 핵심 도메인 (Coverage)
1. **임금/수당:** 주휴수당, 퇴직금, 포괄임금제 분석.
2. **근로시간/휴가:** 52시간제 준수 여부 및 연차 유급휴가 계산.
3. **고용보장/해고:** 부당해고 판례 매칭 및 실업급여 수급 자격 진단.
4. **일·가정 양립:** 임신/육아기 단축근무, 육아휴직 및 복직 후 권리 보호.

### 🛡️ 리스크 관리 (Compliance)
- **Source Citation:** 답변의 근거가 되는 법 조항과 판례 번호를 명시합니다.
- **Disclaimer:** 모든 답변 하단에 "본 서비스는 법적 효력이 없는 정보 제공용"임을 고지합니다.

---

## 🛠️ 3. 기술 스택 (Tech Stack)
- **언어:** Python 3.10+
- **프레임워크:** FastAPI
- **AI 프레임워크:** LangChain, OpenAI API (GPT-4o 추천)
- **데이터베이스:** ChromaDB (Vector DB)
- **환경 관리:** venv, python-dotenv

---

## 📂 4. 프로젝트 폴더 구조

### 🔹 Backend (Python/FastAPI)
```text
legal-mind-rag/
├── app/                        # [애플리케이션 핵심]
│   ├── api/                    # API 경로 (URL 주소 설정)
│   │   └── v1/                 # 버전 관리 (나중에 v2 만들 때 대비)
│   │       └── endpoints/      # 실제 대화/질문 API 로직
│   ├── core/                   # 설정 (OpenAI 키, 보안 설정)
│   ├── database/               # DB 연결 (Vector DB, RDBMS)
│   ├── services/               # 비즈니스 로직 (RAG 엔진, 텍스트 분석)
│   ├── schemas/                # 데이터 규격 (질문은 문자열, 답변은 객체 등)
│   ├── models/                 # DB 테이블 구조 정의 (필요 시)
│   └── main.py                 # FastAPI 실행 입구
├── data/                       # [데이터 저장소]
│   ├── raw/                    # 법령/판례 PDF 원본
│   ├── processed/              # AI용 텍스트/JSON 가공 데이터
│   └── vectorstore/            # ChromaDB (벡터 엔진) 데이터 저장소
├── docs/                       # [문서화] 기획서, 설계도, API 문서
├── tests/                      # [검증] 코드 테스트용 파일들
├── scripts/                    # [관리] PDF를 DB로 밀어넣는 일회성 실행 스크립트
├── .env                        # [보안] API 키 보관 (수동 생성 필요)
├── .gitignore                  # [관리] Git에 올리지 않을 파일 목록
├── requirements.txt            # [설치] 필요한 라이브러리 목록
└── README.md                   # [대문] 프로젝트 소개

🔹 Frontend (React/Tailwind CSS) - 추후 확장 예정

legal-mind-frontend/
├── src/
│   ├── components/      # UI 컴포넌트 (ChatWindow, Message 등)
│   ├── hooks/           # API 통신 및 상태 로직 분리
│   ├── pages/           # 메인 채팅 및 서비스 소개 페이지
│   ├── services/        # 백엔드(FastAPI)와 통신하는 함수
│   ├── styles/          # Tailwind CSS 스타일 설정
│   └── utils/           # 유틸리티 (날짜 변환, 텍스트 가공 등)
├── tailwind.config.js   # Tailwind 설정
└── package.json         # 라이브러리 관리