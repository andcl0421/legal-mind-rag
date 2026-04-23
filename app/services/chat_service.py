from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.models import AnswerMeta, AnswerTrace, ChatSession, Message
from app.schemas.chat import AnswerMetaResponse, AnswerTraceResponse, ChatMessageResponse, ChatResponse
from app.services.knowledge_base import KnowledgeChunk, search_knowledge


DISCLAIMER = "본 답변은 일반적인 노동법 정보 제공 목적이며, 개별 사건에 대한 법적 자문이 아닙니다."


def _choose_category(chunks: Sequence[tuple[KnowledgeChunk, float]]) -> str:
    return chunks[0][0].category if chunks else "일반 상담"


def _choose_risk_level(question: str) -> str:
    urgent_keywords = ("해고", "징계", "체불", "권고사직", "불이익", "신고", "괴롭힘")
    caution_keywords = ("연차", "휴가", "퇴직금", "주휴", "육아휴직")
    if any(keyword in question for keyword in urgent_keywords):
        return "주의"
    if any(keyword in question for keyword in caution_keywords):
        return "보통"
    return "확인 필요"


def _build_title(question: str, category: str) -> str:
    compact = question.strip().replace("\n", " ")
    compact = compact[:24] + "..." if len(compact) > 24 else compact
    return f"{category} 상담 - {compact}"


def _build_answer(question: str, chunks: Sequence[tuple[KnowledgeChunk, float]]) -> tuple[str, str | None, float]:
    primary_chunk, primary_score = chunks[0]
    applied_rule = f"{primary_chunk.rule_label} ({primary_chunk.source_file})"

    answer_lines = [
        f"질문을 보면 핵심 쟁점은 `{primary_chunk.category}` 범주에 가깝습니다.",
        f"우선 참고한 문서 내용은 다음과 같습니다: {primary_chunk.content}",
    ]

    if len(chunks) > 1:
        related_titles = ", ".join(f"{chunk.title}" for chunk, _ in chunks[1:])
        answer_lines.append(f"함께 확인하면 좋은 쟁점은 {related_titles} 입니다.")

    answer_lines.append(
        "정확한 판단을 위해서는 근무형태, 계약서 내용, 근속기간, 사업장 규모 같은 사실관계를 추가로 확인하는 것이 좋습니다."
    )
    if primary_chunk.article_number:
        answer_lines.append(f"주요 참고 조항: {primary_chunk.article_number}")
    answer_lines.append(f"주요 참고 문서: {primary_chunk.source_file}")
    answer_lines.append(f"현재 질문: {question}")

    return "\n\n".join(answer_lines), applied_rule, round(max(primary_score, 0.3), 2)


def process_chat_message(db: Session, content: str, chat_session_id: str | None = None) -> ChatResponse:
    content = content.strip()
    if not content:
        raise ValueError("content must not be empty")

    session = None
    if chat_session_id:
        session = db.query(ChatSession).filter(ChatSession.chat_session_id == chat_session_id).first()

    chunks = search_knowledge(content, top_k=3)
    if not chunks:
        raise ValueError("현재 검색 가능한 문서가 없어 상담 로직을 진행할 수 없습니다.")
    category = _choose_category(chunks)
    risk_level = _choose_risk_level(content)

    if session is None:
        session = ChatSession(
            title=_build_title(content, category),
            category=category,
            risk_level=risk_level,
            summary=None,
        )
        db.add(session)
        db.flush()
    else:
        session.category = category
        session.risk_level = risk_level
        if not session.title:
            session.title = _build_title(content, category)

    last_message = (
        db.query(Message)
        .filter(Message.chat_session_id == session.chat_session_id)
        .order_by(Message.message_index.desc())
        .first()
    )
    next_index = 1 if last_message is None else last_message.message_index + 1

    user_message = Message(
        chat_session_id=session.chat_session_id,
        message_index=next_index,
        role="user",
        content=content,
    )
    db.add(user_message)
    db.flush()

    answer_text, applied_rule, confidence_score = _build_answer(content, chunks)
    assistant_message = Message(
        chat_session_id=session.chat_session_id,
        message_index=next_index + 1,
        role="assistant",
        content=answer_text,
        parent_message_id=user_message.message_id,
    )
    db.add(assistant_message)
    db.flush()

    answer_meta = AnswerMeta(
        message_id=assistant_message.message_id,
        disclaimer=DISCLAIMER,
        applied_rule=applied_rule,
        confidence_score=confidence_score,
    )
    db.add(answer_meta)
    db.flush()

    traces: list[AnswerTrace] = []
    for step_order, (chunk, score) in enumerate(chunks, start=1):
        trace = AnswerTrace(
            message_id=assistant_message.message_id,
            chunk_id=chunk.chunk_id,
            step_order=step_order,
            logic_type="keyword_match",
            relevance_score=round(score, 2),
        )
        db.add(trace)
        traces.append(trace)

    db.commit()

    return ChatResponse(
        chat_session_id=str(session.chat_session_id),
        title=session.title,
        category=session.category,
        risk_level=session.risk_level,
        messages=[
            ChatMessageResponse(message_id=user_message.message_id, role=user_message.role, content=user_message.content),
            ChatMessageResponse(
                message_id=assistant_message.message_id,
                role=assistant_message.role,
                content=assistant_message.content,
            ),
        ],
        answer_meta=AnswerMetaResponse(
            disclaimer=answer_meta.disclaimer,
            applied_rule=answer_meta.applied_rule,
            confidence_score=answer_meta.confidence_score,
        ),
        answer_traces=[
            AnswerTraceResponse(
                chunk_id=trace.chunk_id,
                step_order=trace.step_order,
                logic_type=trace.logic_type,
                relevance_score=trace.relevance_score,
            )
            for trace in traces
        ],
    )
