import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
APP_DIR = ROOT_DIR / "app"
DEFAULT_SQLITE_PATH = ROOT_DIR / "sql_app.db"
ROOT_ENV_PATH = ROOT_DIR / ".env"
APP_ENV_PATH = APP_DIR / ".env"


def _load_environment_files() -> None:
    # VS Code / terminal launch directory와 무관하게 프로젝트에서 사용하는 .env를 명시적으로 읽는다.
    for env_path in (ROOT_ENV_PATH, APP_ENV_PATH):
        if env_path.exists():
            load_dotenv(dotenv_path=env_path, override=False)


_load_environment_files()


def _normalize_sync_database_url(raw_url: str) -> str:
    if raw_url.startswith("postgresql+asyncpg://"):
        return raw_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    return raw_url


class Settings:
    PROJECT_NAME: str = "Legal-Mind AI"
    PROJECT_VERSION: str = "1.0.0"
    
    # DB 설정: 프로젝트 루트의 sqlite 파일을 기본값으로 사용합니다.
    _RAW_DATABASE_URL = os.getenv(
        "SQLALCHEMY_DATABASE_URL",
        os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"),
    )
    SQLALCHEMY_DATABASE_URL = _normalize_sync_database_url(_RAW_DATABASE_URL)
    
    # 보안 설정 (나중에 로그인 기능 때 사용)
    SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-me")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    PUBLIC_DATA_SERVICE_KEY = os.getenv("PUBLIC_DATA_SERVICE_KEY", os.getenv("serviceKey", ""))
    LAW_GO_KR_API_KEY = os.getenv("LAW_GO_KR_API_KEY", "")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30

settings = Settings()
