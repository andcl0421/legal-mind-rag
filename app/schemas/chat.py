from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    content: str = Field(..., min_length=1, description="사용자 상담 질문")
    chat_session_id: str | None = Field(default=None, description="기존 상담 세션 ID")


class ChatMessageResponse(BaseModel):
    message_id: int
    role: str
    content: str


class AnswerMetaResponse(BaseModel):
    disclaimer: str | None = None
    applied_rule: str | None = None
    confidence_score: float | None = None


class AnswerTraceResponse(BaseModel):
    chunk_id: int | None = None
    step_order: int | None = None
    logic_type: str | None = None
    relevance_score: float | None = None


class ChatResponse(BaseModel):
    chat_session_id: str
    title: str | None = None
    category: str | None = None
    risk_level: str | None = None
    messages: list[ChatMessageResponse]
    answer_meta: AnswerMetaResponse
    answer_traces: list[AnswerTraceResponse]
