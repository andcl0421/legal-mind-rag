import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE_PATH = ROOT_DIR / "sql_app.db"

class Settings:
    PROJECT_NAME: str = "Legal-Mind AI"
    PROJECT_VERSION: str = "1.0.0"
    
    # DB 설정: 프로젝트 루트의 sqlite 파일을 기본값으로 사용합니다.
    SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}")
    
    # 보안 설정 (나중에 로그인 기능 때 사용)
    SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-me")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30

settings = Settings()
