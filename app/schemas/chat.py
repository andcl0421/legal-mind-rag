from datetime import datetime

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    content: str = Field(..., min_length=1, description="사용자 상담 질문")
    chat_session_id: str | None = Field(default=None, description="기존 상담 세션 ID")
    user_id: str | None = Field(default=None, description="로그인 사용자 ID (자동 알림 연결용)")
    company_size: str | None = Field(default=None, description="사업장 규모 (예: 5인 미만, 5인 이상)")
    industry: str | None = Field(default=None, description="업종 (예: 제조업, IT, 서비스업)")
    employment_type: str | None = Field(default=None, description="고용 형태 (예: 정규직, 계약직, 파견)")
    employment_status: str | None = Field(default=None, description="재직 상태 (예: 재직 중, 퇴사 예정, 퇴사)")


class ChatMessageResponse(BaseModel):
    message_id: int
    role: str
    content: str
    message_index: int | None = None
    parent_message_id: int | None = None
    created_at: datetime | None = None


class AnswerSourceResponse(BaseModel):
    chunk_id: int | None = None
    title: str | None = None
    source_file: str | None = None
    article_number: str | None = None
    page_number: int | None = None
    source_label: str | None = None
    citation: str | None = None
    excerpt: str | None = None
    relevance_score: float | None = None


class AnswerSectionResponse(BaseModel):
    heading: str
    body: str
    citation: str | None = None
    source_chunk_ids: list[int] = Field(default_factory=list)


class StructuredAnswerResponse(BaseModel):
    summary: str
    answer: str
    answer_sections: list[AnswerSectionResponse]
    guidance: list[str]
    caution: str | None = None
    cited_rules: list[str]
    primary_citation: str | None = None
    sources: list[AnswerSourceResponse]


class AnswerMetaResponse(BaseModel):
    disclaimer: str | None = None
    applied_rule: str | None = None
    confidence_score: float | None = None


class AnswerTraceResponse(BaseModel):
    chunk_id: int | None = None
    step_order: int | None = None
    logic_type: str | None = None
    relevance_score: float | None = None
    citation: str | None = None
    source_label: str | None = None


class ChatResponse(BaseModel):
    chat_session_id: str
    title: str | None = None
    category: str | None = None
    risk_level: str | None = None
    latest_user_message: ChatMessageResponse
    latest_assistant_message: ChatMessageResponse
    structured_answer: StructuredAnswerResponse
    messages: list[ChatMessageResponse]
    answer_meta: AnswerMetaResponse
    answer_traces: list[AnswerTraceResponse]


class ChatSessionSummaryResponse(BaseModel):
    chat_session_id: str
    title: str | None = None
    category: str | None = None
    risk_level: str | None = None
    summary: str | None = None
    last_message_preview: str | None = None
    message_count: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ChatSessionListResponse(BaseModel):
    sessions: list[ChatSessionSummaryResponse]


class ChatSessionDetailResponse(BaseModel):
    chat_session_id: str
    title: str | None = None
    category: str | None = None
    risk_level: str | None = None
    summary: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    messages: list[ChatMessageResponse]


class ChatMessageHistoryResponse(BaseModel):
    chat_session_id: str
    messages: list[ChatMessageResponse]
