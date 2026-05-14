import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models import User, UserChecklistItem
from app.schemas import ChecklistItemListResponse, ChecklistItemResponse, ChecklistItemUpsertRequest

router = APIRouter()
security = HTTPBearer(auto_error=False)


def _get_current_user(
    db: Session,
    credentials: HTTPAuthorizationCredentials | None,
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 토큰이 필요합니다.")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("missing subject")
        user_uuid = uuid.UUID(str(user_id))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다.") from exc

    user = db.query(User).filter(User.user_id == user_uuid).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없거나 비활성 상태입니다.")
    return user


def _serialize(item: UserChecklistItem) -> ChecklistItemResponse:
    return ChecklistItemResponse(
        checklist_item_id=item.checklist_item_id,
        chat_session_id=item.chat_session_id,
        item_type=item.item_type,
        item_text=item.item_text,
        is_done=item.is_done,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=ChecklistItemListResponse)
def list_checklist_items(
    chat_session_id: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = _get_current_user(db=db, credentials=credentials)
    items = (
        db.query(UserChecklistItem)
        .filter(
            UserChecklistItem.user_id == user.user_id,
            UserChecklistItem.chat_session_id == chat_session_id,
        )
        .order_by(UserChecklistItem.created_at.asc())
        .all()
    )
    return ChecklistItemListResponse(items=[_serialize(item) for item in items])


@router.post("", response_model=ChecklistItemResponse)
def upsert_checklist_item(
    payload: ChecklistItemUpsertRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = _get_current_user(db=db, credentials=credentials)
    row = (
        db.query(UserChecklistItem)
        .filter(
            UserChecklistItem.user_id == user.user_id,
            UserChecklistItem.chat_session_id == payload.chat_session_id,
            UserChecklistItem.item_type == payload.item_type,
            UserChecklistItem.item_text == payload.item_text.strip(),
        )
        .first()
    )
    if row is None:
        row = UserChecklistItem(
            user_id=user.user_id,
            chat_session_id=payload.chat_session_id,
            item_type=payload.item_type,
            item_text=payload.item_text.strip(),
            is_done=payload.is_done,
        )
        db.add(row)
    else:
        row.is_done = payload.is_done

    db.commit()
    db.refresh(row)
    return _serialize(row)
