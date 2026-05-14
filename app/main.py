from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.api.v1 import api  # 우리가 만든 중앙 통제실 연결
from app.database.session import Base, engine
from app.models import AnswerMeta, AnswerTrace, ChatSession, Message, User, UserChecklistItem, UserFile, UserNotification

# 1. FastAPI 앱 인스턴스 생성
app = FastAPI(
    title="Legal-Mind AI",
    description="RAG 기반 지능형 노무 상담 서비스",
    version="1.0.0"
)

Base.metadata.create_all(bind=engine)


def _ensure_notification_columns() -> None:
    inspector = inspect(engine)
    if "user_notifications" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("user_notifications")}
    statements: list[str] = []
    if "source" not in columns:
        statements.append("ALTER TABLE user_notifications ADD COLUMN source VARCHAR DEFAULT 'manual'")
    if "alert_type" not in columns:
        statements.append("ALTER TABLE user_notifications ADD COLUMN alert_type VARCHAR")
    if "chat_session_id" not in columns:
        statements.append("ALTER TABLE user_notifications ADD COLUMN chat_session_id VARCHAR")
    if "due_date" not in columns:
        statements.append("ALTER TABLE user_notifications ADD COLUMN due_date TIMESTAMP")
    if not statements:
        return
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


_ensure_notification_columns()


def _ensure_user_files_columns() -> None:
    inspector = inspect(engine)
    if "user_files" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("user_files")}
    statements: list[str] = []
    if "category" not in columns:
        statements.append("ALTER TABLE user_files ADD COLUMN category VARCHAR")
    if "chat_session_id" not in columns:
        statements.append("ALTER TABLE user_files ADD COLUMN chat_session_id VARCHAR")
    if not statements:
        return
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


_ensure_user_files_columns()

# 2. CORS 설정 (프론트엔드와 백엔드가 서로 대화할 수 있게 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 배포 시에는 특정 주소만 허용하도록 수정
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 라우터 연결 (중앙 통제실에서 가져온 모든 길을 서버에 등록)
app.include_router(api.api_router, prefix="/api/v1")

# 4. 접속 확인용 헬스체크 엔드포인트
@app.get("/")
async def root():
    return {"message": "Legal-Mind AI Server is Running!"}
