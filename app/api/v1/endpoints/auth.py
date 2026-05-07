from datetime import UTC, datetime, timedelta
import uuid

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models import User
from app.schemas import AuthResponse, LoginRequest, SignUpRequest, TokenResponse, UserProfileResponse

router = APIRouter()
security = HTTPBearer(auto_error=False)
ALLOWED_EMP_COUNT_TYPES = {"UNDER_5", "OVER_5", "OVER_30", "OVER_300"}


@router.get("/health")
def auth_health():
    return {"status": "ok"}


def _hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def _normalize_email(raw: str) -> str:
    email = raw.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효한 이메일 형식이 아닙니다.")
    return email


def _build_token(user: User) -> TokenResponse:
    expire_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expires_at = datetime.now(UTC) + expire_delta
    payload = {
        "sub": str(user.user_id),
        "email": user.email,
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return TokenResponse(
        access_token=token,
        expires_in=int(expire_delta.total_seconds()),
    )


def _serialize_user(user: User) -> UserProfileResponse:
    return UserProfileResponse(
        user_id=str(user.user_id),
        email=user.email,
        nickname=user.nickname,
        emp_count_type=user.emp_count_type,
        region_code=user.region_code,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _normalize_emp_count_type(raw: str) -> str:
    value = raw.strip().upper()
    if value not in ALLOWED_EMP_COUNT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="emp_count_type은 UNDER_5, OVER_5, OVER_30, OVER_300 중 하나여야 합니다.",
        )
    return value


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


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def sign_up(payload: SignUpRequest, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    emp_count_type = _normalize_emp_count_type(payload.emp_count_type)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 가입된 이메일입니다.")

    user = User(
        email=email,
        password_hash=_hash_password(payload.password),
        nickname=payload.nickname,
        emp_count_type=emp_count_type,
        region_code=payload.region_code,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthResponse(user=_serialize_user(user), token=_build_token(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    if user is None or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성 사용자입니다.")

    user.last_login_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)

    return AuthResponse(user=_serialize_user(user), token=_build_token(user))


@router.get("/me", response_model=UserProfileResponse)
def me(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = _get_current_user(db=db, credentials=credentials)
    return _serialize_user(user)
