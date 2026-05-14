from pathlib import Path
import uuid

import jwt
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models import ChatSession, User, UserFile
from app.schemas import EvidenceFileResponse, EvidenceListResponse

router = APIRouter()
security = HTTPBearer(auto_error=False)
UPLOAD_DIR = Path(__file__).resolve().parents[4] / "data" / "user_uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".doc", ".docx"}


def _serialize_file(item: UserFile) -> EvidenceFileResponse:
    return EvidenceFileResponse(
        user_file_id=item.user_file_id,
        original_filename=item.original_filename,
        mime_type=item.mime_type,
        file_size=item.file_size,
        description=item.description,
        category=item.category,
        chat_session_id=str(item.chat_session_id) if item.chat_session_id else None,
        created_at=item.created_at,
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


def _resolve_user_file_path(user_id: str, stored_filename: str) -> Path:
    return (UPLOAD_DIR / user_id / stored_filename).resolve()


@router.post("", response_model=EvidenceFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_evidence_file(
    file: UploadFile = File(...),
    description: str | None = Form(default=None),
    category: str | None = Form(default=None),
    chat_session_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = _get_current_user(db=db, credentials=credentials)
    original_name = file.filename or "untitled"
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="지원하지 않는 파일 형식입니다.")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="빈 파일은 업로드할 수 없습니다.")
    if len(payload) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="파일 용량은 10MB 이하만 허용됩니다.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    user_dir = (UPLOAD_DIR / str(user.user_id)).resolve()
    user_dir.mkdir(parents=True, exist_ok=True)

    stored_filename = f"{uuid.uuid4().hex}{extension}"
    stored_path = _resolve_user_file_path(str(user.user_id), stored_filename)
    stored_path.write_bytes(payload)
    linked_chat_session_id: uuid.UUID | None = None
    if chat_session_id:
        try:
            parsed_session_id = uuid.UUID(chat_session_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="chat_session_id 형식이 올바르지 않습니다.") from exc
        session = (
            db.query(ChatSession)
            .filter(
                ChatSession.chat_session_id == parsed_session_id,
                ChatSession.user_id == user.user_id,
                ChatSession.is_deleted.is_(False),
            )
            .first()
        )
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="연결할 상담 세션을 찾을 수 없습니다.")
        linked_chat_session_id = parsed_session_id

    row = UserFile(
        user_id=user.user_id,
        original_filename=original_name,
        stored_filename=stored_filename,
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(payload),
        description=description.strip() if description else None,
        category=category.strip() if category else None,
        chat_session_id=linked_chat_session_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_file(row)


@router.get("", response_model=EvidenceListResponse)
def list_evidence_files(
    category: str | None = None,
    chat_session_id: str | None = None,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = _get_current_user(db=db, credentials=credentials)
    query = db.query(UserFile).filter(UserFile.user_id == user.user_id, UserFile.is_deleted.is_(False))
    if category:
        query = query.filter(UserFile.category == category)
    if chat_session_id:
        try:
            parsed_session_id = uuid.UUID(chat_session_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="chat_session_id 형식이 올바르지 않습니다.") from exc
        query = query.filter(UserFile.chat_session_id == parsed_session_id)
    items = query.order_by(UserFile.created_at.desc()).all()
    return EvidenceListResponse(items=[_serialize_file(item) for item in items])


@router.get("/{user_file_id}/download")
def download_evidence_file(
    user_file_id: int,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = _get_current_user(db=db, credentials=credentials)
    row = (
        db.query(UserFile)
        .filter(
            UserFile.user_file_id == user_file_id,
            UserFile.user_id == user.user_id,
            UserFile.is_deleted.is_(False),
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="파일을 찾을 수 없습니다.")

    target = _resolve_user_file_path(str(user.user_id), row.stored_filename)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="저장된 파일이 없습니다.")

    return FileResponse(path=target, media_type=row.mime_type, filename=row.original_filename)


@router.delete("/{user_file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_evidence_file(
    user_file_id: int,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = _get_current_user(db=db, credentials=credentials)
    row = (
        db.query(UserFile)
        .filter(
            UserFile.user_file_id == user_file_id,
            UserFile.user_id == user.user_id,
            UserFile.is_deleted.is_(False),
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="파일을 찾을 수 없습니다.")

    row.is_deleted = True
    db.commit()
    return None
