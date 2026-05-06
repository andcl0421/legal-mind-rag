from datetime import UTC, datetime
import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models import User, UserNotification
from app.schemas import AlertCreateRequest, AlertListResponse, AlertResponse

router = APIRouter()
security = HTTPBearer(auto_error=False)


@router.get("/health")
def alerts_health():
    return {"status": "ok"}


def _serialize_alert(item: UserNotification) -> AlertResponse:
    return AlertResponse(
        user_notif_id=item.user_notif_id,
        title=item.title,
        content=item.content,
        is_read=item.is_read,
        created_at=item.created_at,
        read_at=item.read_at,
    )


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


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
def create_alert(
    payload: AlertCreateRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = _get_current_user(db=db, credentials=credentials)
    row = UserNotification(
        user_id=user.user_id,
        title=payload.title.strip(),
        content=payload.content.strip(),
        is_read=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_alert(row)


@router.get("", response_model=AlertListResponse)
def list_alerts(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = _get_current_user(db=db, credentials=credentials)
    query = db.query(UserNotification).filter(UserNotification.user_id == user.user_id)
    if unread_only:
        query = query.filter(UserNotification.is_read.is_(False))
    items = query.order_by(UserNotification.created_at.desc()).limit(limit).all()
    return AlertListResponse(items=[_serialize_alert(item) for item in items])


@router.patch("/{user_notif_id}/read", response_model=AlertResponse)
def mark_alert_read(
    user_notif_id: int,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = _get_current_user(db=db, credentials=credentials)
    row = (
        db.query(UserNotification)
        .filter(
            UserNotification.user_notif_id == user_notif_id,
            UserNotification.user_id == user.user_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="알림을 찾을 수 없습니다.")

    row.is_read = True
    row.read_at = datetime.now(UTC)
    db.commit()
    db.refresh(row)
    return _serialize_alert(row)
