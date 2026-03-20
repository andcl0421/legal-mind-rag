import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "Legal-Mind AI"
    PROJECT_VERSION: str = "1.0.0"
    
    # DB 설정: 현재 폴더에 sql_app.db라는 이름으로 파일을 만듭니다.
    SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
    
    # 보안 설정 (나중에 로그인 기능 때 사용)
    SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-me")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30

settings = Settings()