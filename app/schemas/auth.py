from datetime import datetime

from pydantic import BaseModel, Field


class SignUpRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    nickname: str | None = Field(default=None, max_length=50)
    emp_count_type: str = Field(..., min_length=1, max_length=50)
    region_code: str | None = Field(default=None, max_length=10)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)


class ProfileUpdateRequest(BaseModel):
    nickname: str | None = Field(default=None, max_length=50)
    emp_count_type: str = Field(..., min_length=1, max_length=50)
    region_code: str | None = Field(default=None, max_length=10)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    nickname: str | None = None
    emp_count_type: str
    region_code: str | None = None
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AuthResponse(BaseModel):
    user: UserProfileResponse
    token: TokenResponse
