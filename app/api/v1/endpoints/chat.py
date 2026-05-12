import uuid
from pathlib import Path

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models import User
from app.schemas import (
    ChatMessageHistoryResponse,
    ChatRequest,
    ChatResponse,
    ChatSessionDetailResponse,
    ChatSessionListResponse,
)
from app.services import (
    delete_chat_session,
    generate_chat_session_report,
    get_chat_message_history,
    get_chat_session_detail,
    list_chat_sessions,
    process_chat_message,
)


router = APIRouter()
security = HTTPBearer(auto_error=False)
RAW_DOCS_DIR = Path(__file__).resolve().parents[4] / "data" / "raw"


def _get_current_active_user(
    db: Session,
    credentials: HTTPAuthorizationCredentials | None,
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 토큰이 필요합니다.")

    token = credentials.credentials
    try:
        claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = claims.get("sub")
        user_uuid = uuid.UUID(str(user_id))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다.") from exc

    user = db.query(User).filter(User.user_id == user_uuid, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없거나 비활성 상태입니다.")
    return user


@router.get("/health")
def chat_health():
    return {"status": "ok"}


@router.get("/documents/view")
def view_source_document(source_file: str = Query(..., min_length=1)):
    target = (RAW_DOCS_DIR / source_file).resolve()
    try:
        target.relative_to(RAW_DOCS_DIR.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="허용되지 않은 문서 경로입니다.") from exc

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="원본 문서를 찾을 수 없습니다.")

    return FileResponse(
        path=target,
        media_type="application/pdf",
    )


@router.get("", response_model=ChatSessionListResponse)
def get_chat_sessions(db: Session = Depends(get_db)):
    return list_chat_sessions(db=db)


@router.get("/{chat_session_id}", response_model=ChatSessionDetailResponse)
def get_chat_session(chat_session_id: str, db: Session = Depends(get_db)):
    try:
        return get_chat_session_detail(db=db, chat_session_id=chat_session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{chat_session_id}/messages", response_model=ChatMessageHistoryResponse)
def get_chat_session_messages(chat_session_id: str, db: Session = Depends(get_db)):
    try:
        return get_chat_message_history(db=db, chat_session_id=chat_session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{chat_session_id}/report.pdf")
def download_chat_session_report(
    chat_session_id: str,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    try:
        user = _get_current_active_user(db=db, credentials=credentials)
        filename, pdf_bytes = generate_chat_session_report(
            db=db,
            chat_session_id=chat_session_id,
            requester_user_id=str(user.user_id),
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("", response_model=ChatResponse)
def create_chat_message(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    try:
        user = _get_current_active_user(db=db, credentials=credentials)

        user_context = {
            "company_size": payload.company_size,
            "industry": payload.industry,
            "employment_type": payload.employment_type,
            "employment_status": payload.employment_status,
        }
        return process_chat_message(
            db=db,
            content=payload.content,
            chat_session_id=payload.chat_session_id,
            user_id=str(user.user_id),
            user_context=user_context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{chat_session_id}")
def remove_chat_session(
    chat_session_id: str,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    try:
        user = _get_current_active_user(db=db, credentials=credentials)
        return delete_chat_session(db=db, chat_session_id=chat_session_id, requester_user_id=str(user.user_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
