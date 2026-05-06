from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas import (
    ChatMessageHistoryResponse,
    ChatRequest,
    ChatResponse,
    ChatSessionDetailResponse,
    ChatSessionListResponse,
)
from app.services import (
    get_chat_message_history,
    get_chat_session_detail,
    list_chat_sessions,
    process_chat_message,
)


router = APIRouter()


@router.get("/health")
def chat_health():
    return {"status": "ok"}


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


@router.post("", response_model=ChatResponse)
def create_chat_message(payload: ChatRequest, db: Session = Depends(get_db)):
    try:
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
            user_context=user_context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
