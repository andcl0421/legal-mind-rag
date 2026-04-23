from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas import ChatRequest, ChatResponse
from app.services import process_chat_message


router = APIRouter()


@router.get("/health")
def chat_health():
    return {"status": "ok"}


@router.post("", response_model=ChatResponse)
def create_chat_message(payload: ChatRequest, db: Session = Depends(get_db)):
    try:
        return process_chat_message(db=db, content=payload.content, chat_session_id=payload.chat_session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
