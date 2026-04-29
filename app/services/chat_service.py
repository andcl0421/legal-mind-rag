from collections.abc import Sequence
import re
import uuid

from sqlalchemy.orm import Session

from app.models import AnswerMeta, AnswerTrace, ChatSession, Message
from app.schemas.chat import (
    AnswerMetaResponse,
    AnswerSourceResponse,
    AnswerTraceResponse,
    ChatMessageHistoryResponse,
    ChatMessageResponse,
    ChatResponse,
    ChatSessionDetailResponse,
    ChatSessionListResponse,
    ChatSessionSummaryResponse,
    StructuredAnswerResponse,
)
from app.services.knowledge_base import KnowledgeChunk, search_knowledge


DISCLAIMER = (
    "본 응답은 일반적인 노동법 정보 제공을 위한 안내이며, "
    "구체적인 사실관계에 대한 법률 자문을 대신하지 않습니다."
)

GENERAL_CATEGORY = "일반 상담"


def _choose_category(chunks: Sequence[tuple[KnowledgeChunk, float]]) -> str:
    return chunks[0][0].category if chunks else GENERAL_CATEGORY


def _choose_risk_level(question: str) -> str:
    urgent_keywords = ("해고", "징계", "체불", "권고사직", "불이익", "전직", "감봉")
    caution_keywords = ("휴게", "휴일", "퇴직금", "주휴", "육아휴직")
    if any(keyword in question for keyword in urgent_keywords):
        return "주의"
    if any(keyword in question for keyword in caution_keywords):
        return "보통"
    return "확인 필요"


def _build_title(question: str, category: str) -> str:
    compact = question.strip().replace("\n", " ")
    compact = compact[:24] + "..." if len(compact) > 24 else compact
    return f"{category} 상담 - {compact}"


def _serialize_message(message: Message) -> ChatMessageResponse:
    return ChatMessageResponse(
        message_id=message.message_id,
        role=message.role,
        content=message.content,
        message_index=message.message_index,
        parent_message_id=message.parent_message_id,
        created_at=message.created_at,
    )


def _build_message_preview(message: Message | None, limit: int = 80) -> str | None:
    if message is None:
        return None
    compact = _normalize_space(message.content)
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rstrip() + "..."


def _parse_chat_session_id(chat_session_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(chat_session_id)
    except ValueError as exc:
        raise ValueError("유효하지 않은 상담 세션 ID입니다.") from exc


def _normalize_space(text: str) -> str:
    return " ".join(text.split()).strip()


def _clean_law_title(title: str) -> str:
    cleaned = re.sub(r"\((법률|대통령령)\)\(제\d+호\)\(\d{8}\)$", "", title)
    return cleaned.strip()


def _clip_excerpt(text: str, limit: int = 220) -> str:
    compact = _normalize_space(text)
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rstrip() + "..."


def _sanitize_chunk_text(text: str) -> str:
    cleaned = _normalize_space(text)
    cleaned = re.sub(r"법제처\s*\d+\s*국가법령정보센터", "", cleaned)
    cleaned = re.sub(r"\[[^\]]+\]", "", cleaned)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip(" ,")


def _extract_focus_excerpt(chunk: KnowledgeChunk, limit: int = 160) -> str:
    text = _sanitize_chunk_text(chunk.content)
    if not text:
        return ""

    if chunk.article_number:
        idx = text.find(chunk.article_number)
        if idx >= 0:
            start = max(idx - 30, 0)
            snippet = text[start : start + limit]
            return _clip_excerpt(snippet, limit=limit)

    article_match = re.search(r"제\d+조[^.]{0,120}", text)
    if article_match:
        return _clip_excerpt(article_match.group(0), limit=limit)

    sentence_match = re.search(r"[^.]{20,180}", text)
    if sentence_match:
        return _clip_excerpt(sentence_match.group(0), limit=limit)

    return _clip_excerpt(text, limit=limit)


def _build_source_label(chunk: KnowledgeChunk) -> str:
    base_title = _clean_law_title(chunk.title)
    parts = [base_title]
    if chunk.article_number:
        parts.append(chunk.article_number)
    if chunk.page_number:
        parts.append(f"{chunk.page_number}쪽")
    return " | ".join(parts)


def _build_citation(chunk: KnowledgeChunk) -> str:
    base_title = _clean_law_title(chunk.title)
    if chunk.article_number and chunk.page_number:
        return f"{base_title} {chunk.article_number}, {chunk.page_number}쪽"
    if chunk.article_number:
        return f"{base_title} {chunk.article_number}"
    if chunk.page_number:
        return f"{base_title}, {chunk.page_number}쪽"
    return base_title


def _build_guidance(chunks: Sequence[tuple[KnowledgeChunk, float]]) -> list[str]:
    guidance = [
        "질문과 직접 관련된 근로계약서, 취업규칙, 급여명세서를 함께 확인해 보시는 것이 좋습니다.",
        "실제 적용 여부는 사업장 규모, 재직 상태, 발생 시점에 따라 달라질 수 있습니다.",
        "분쟁 가능성이 있다면 날짜, 통보 내용, 지급 내역을 시간순으로 정리해 두시는 편이 도움이 됩니다.",
    ]
    if len(chunks) > 1:
        related_sources = ", ".join(dict.fromkeys(_build_citation(chunk) for chunk, _ in chunks[1:]))
        guidance.append(f"함께 확인해 볼 만한 조문은 {related_sources}입니다.")
    return guidance


def _build_answer_body(primary_chunk: KnowledgeChunk, category: str) -> str:
    citation = _build_citation(primary_chunk)
    focus_excerpt = _extract_focus_excerpt(primary_chunk)
    category_hint = {
        "임금/수당": "임금의 산정 기준과 실제 지급 방식이 조문 취지에 맞는지 먼저 살펴보는 것이 좋습니다.",
        "근로시간/휴가": "휴일, 휴가, 근로시간 산정 기준이 어떻게 연결되는지 중심으로 보시는 편이 좋습니다.",
        "고용보장/해고": "해고 사유와 절차가 법 기준에 맞는지 순서대로 점검해 보셔야 합니다.",
        "일·가정 양립": "휴직 요건, 사용 기간, 불이익 금지 여부를 함께 확인하시는 것이 중요합니다.",
    }.get(category, "사실관계와 조문 기준을 함께 맞춰 보시는 것이 중요합니다.")

    lines = [
        f"우선 기준이 되는 조문은 {citation}입니다.",
        category_hint,
    ]
    if focus_excerpt:
        lines.append(f"조문상 핵심은 다음과 같습니다. {focus_excerpt}")
    lines.append(
        "다만 이 조문이 질문 상황에 그대로 적용되는지는 근로형태, 실제 근무 방식, 회사의 운영 방식까지 함께 봐야 합니다."
    )
    return " ".join(lines)


def _build_assistant_text(
    summary: str,
    answer: str,
    guidance: list[str],
    primary_citation: str | None,
    question: str,
) -> str:
    lines = [summary, "", answer, "", "참고하실 점", *(f"- {item}" for item in guidance)]
    if primary_citation:
        lines.extend(["", f"주요 근거 조문: {primary_citation}"])
    lines.extend(["", f"질문 내용: {question}"])
    return "\n".join(lines)


def _build_structured_answer(
    question: str,
    category: str,
    chunks: Sequence[tuple[KnowledgeChunk, float]],
) -> tuple[StructuredAnswerResponse, str | None, float, str]:
    primary_chunk, primary_score = chunks[0]
    primary_citation = _build_citation(primary_chunk)
    applied_rule = primary_citation

    summary = (
        f"질문 내용은 `{category}` 범주로 보이며, "
        f"우선적으로 {primary_citation}을 확인해 보시는 것이 적절합니다."
    )
    answer = _build_answer_body(primary_chunk, category)
    guidance = _build_guidance(chunks)
    caution = (
        "개별 사안은 사실관계에 따라 결론이 달라질 수 있으므로, "
        "해고·징계·체불처럼 즉시 대응이 필요한 경우에는 전문 상담과 함께 검토하시는 편이 안전합니다."
    )

    cited_rules = list(dict.fromkeys(_build_citation(chunk) for chunk, _ in chunks))
    sources = [
        AnswerSourceResponse(
            chunk_id=chunk.chunk_id,
            title=chunk.title,
            source_file=chunk.source_file,
            article_number=chunk.article_number,
            page_number=chunk.page_number,
            source_label=_build_source_label(chunk),
            citation=_build_citation(chunk),
            excerpt=_extract_focus_excerpt(chunk),
            relevance_score=round(score, 2),
        )
        for chunk, score in chunks
    ]

    assistant_text = _build_assistant_text(
        summary=summary,
        answer=answer,
        guidance=guidance,
        primary_citation=primary_citation,
        question=question,
    )

    return (
        StructuredAnswerResponse(
            summary=summary,
            answer=answer,
            guidance=guidance,
            caution=caution,
            cited_rules=cited_rules,
            primary_citation=primary_citation,
            sources=sources,
        ),
        applied_rule,
        round(max(primary_score, 0.3), 2),
        assistant_text,
    )


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

    structured_answer, applied_rule, confidence_score, answer_text = _build_structured_answer(
        content,
        category,
        chunks,
    )

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
            logic_type="hybrid_search",
            relevance_score=round(score, 2),
        )
        db.add(trace)
        traces.append(trace)

    db.commit()

    latest_user_message = _serialize_message(user_message)
    latest_assistant_message = _serialize_message(assistant_message)

    return ChatResponse(
        chat_session_id=str(session.chat_session_id),
        title=session.title,
        category=session.category,
        risk_level=session.risk_level,
        latest_user_message=latest_user_message,
        latest_assistant_message=latest_assistant_message,
        structured_answer=structured_answer,
        messages=[latest_user_message, latest_assistant_message],
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


def list_chat_sessions(db: Session) -> ChatSessionListResponse:
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.is_deleted.is_(False))
        .order_by(ChatSession.updated_at.desc(), ChatSession.created_at.desc())
        .all()
    )

    items: list[ChatSessionSummaryResponse] = []
    for session in sessions:
        messages = sorted(session.messages, key=lambda item: item.message_index)
        last_message = messages[-1] if messages else None
        items.append(
            ChatSessionSummaryResponse(
                chat_session_id=str(session.chat_session_id),
                title=session.title,
                category=session.category,
                risk_level=session.risk_level,
                summary=session.summary,
                last_message_preview=_build_message_preview(last_message),
                message_count=len(messages),
                created_at=session.created_at,
                updated_at=session.updated_at,
            )
        )

    return ChatSessionListResponse(sessions=items)


def get_chat_session_detail(db: Session, chat_session_id: str) -> ChatSessionDetailResponse:
    session_uuid = _parse_chat_session_id(chat_session_id)
    session = (
        db.query(ChatSession)
        .filter(
            ChatSession.chat_session_id == session_uuid,
            ChatSession.is_deleted.is_(False),
        )
        .first()
    )
    if session is None:
        raise ValueError("해당 상담 세션을 찾을 수 없습니다.")

    ordered_messages = sorted(session.messages, key=lambda item: item.message_index)
    return ChatSessionDetailResponse(
        chat_session_id=str(session.chat_session_id),
        title=session.title,
        category=session.category,
        risk_level=session.risk_level,
        summary=session.summary,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[_serialize_message(message) for message in ordered_messages],
    )


def get_chat_message_history(db: Session, chat_session_id: str) -> ChatMessageHistoryResponse:
    session_uuid = _parse_chat_session_id(chat_session_id)
    session = (
        db.query(ChatSession)
        .filter(
            ChatSession.chat_session_id == session_uuid,
            ChatSession.is_deleted.is_(False),
        )
        .first()
    )
    if session is None:
        raise ValueError("해당 상담 세션을 찾을 수 없습니다.")

    ordered_messages = sorted(session.messages, key=lambda item: item.message_index)
    return ChatMessageHistoryResponse(
        chat_session_id=str(session.chat_session_id),
        messages=[_serialize_message(message) for message in ordered_messages],
    )
