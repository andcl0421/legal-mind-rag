from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from io import BytesIO
import json
import os
import re
from urllib.parse import quote
import uuid

from openai import OpenAI
from sqlalchemy.orm import Session

from app.models import AnswerMeta, AnswerTrace, ChatSession, Message, UserNotification
from app.schemas.chat import (
    AnswerMetaResponse,
    AnswerSectionResponse,
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
from app.services.knowledge_base import KnowledgeChunk, load_knowledge_base, search_knowledge


DISCLAIMER = (
    "본 응답은 일반적인 노동법 정보 제공을 위한 안내이며, "
    "구체적인 사실관계에 대한 법률 자문을 대신하지 않습니다."
)

GENERAL_CATEGORY = "일반 상담"
DEFAULT_CHAT_MODEL = "gpt-4.1-mini"
LLM_MAX_RETRIES = 2
_ALLOWED_SECTION_HEADINGS = {"핵심 기준", "질문에의 적용", "주의할 점"}

_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "임금/수당": ("임금", "월급", "급여", "수당", "체불", "지연이자", "임금명세서", "퇴직금", "주휴"),
    "근로시간/휴가": ("연차", "휴가", "휴일", "휴게", "근로시간", "야근", "연장근로"),
    "고용보장/해고": ("해고", "해고예고", "권고사직", "징계", "부당해고", "서면통지", "전직", "감봉"),
    "일·가정 양립": ("육아휴직", "육아", "임신", "출산", "복직", "단축근무", "출산전후휴가", "부당대우", "불리한 처우"),
}

_FOLLOW_UP_HINTS = (
    "그럼",
    "그러면",
    "이제",
    "뭐부터",
    "먼저",
    "어떻게",
    "다음",
    "필요한 서류",
    "필요서류",
    "준비 서류",
    "무슨 서류",
    "증거",
    "신고",
    "회사에 뭐라고",
)


def _choose_category(question: str, chunks: Sequence[tuple[KnowledgeChunk, float]]) -> str:
    question_scores = {
        category: sum(1 for keyword in keywords if keyword in question)
        for category, keywords in _CATEGORY_KEYWORDS.items()
    }
    best_question_category = max(question_scores, key=question_scores.get)
    if question_scores[best_question_category] > 0:
        return best_question_category

    chunk_scores: dict[str, float] = {}
    for chunk, score in chunks:
        chunk_scores[chunk.category] = chunk_scores.get(chunk.category, 0.0) + score

    if chunk_scores:
        return max(chunk_scores, key=chunk_scores.get)
    return GENERAL_CATEGORY


def _choose_risk_level(question: str) -> str:
    urgent_keywords = ("해고", "징계", "체불", "권고사직", "불이익", "부당대우", "불리한 처우", "전직", "감봉")
    caution_keywords = ("휴게", "휴일", "퇴직금", "주휴", "육아휴직", "출산전후휴가")
    if any(keyword in question for keyword in urgent_keywords):
        return "주의"
    if any(keyword in question for keyword in caution_keywords):
        return "보통"
    return "확인 필요"


def _build_title(question: str, category: str) -> str:
    compact = question.strip().replace("\n", " ")
    compact = compact[:24] + "..." if len(compact) > 24 else compact
    return f"{category} 상담 - {compact}"


def _is_follow_up_question(question: str) -> bool:
    normalized = _normalize_space(question)
    if any(hint in normalized for hint in _FOLLOW_UP_HINTS):
        return True
    return len(normalized) <= 24 and normalized.endswith(("?", "요", "죠", "가요", "할까요"))


def _build_search_query(
    question: str,
    session: ChatSession | None,
) -> str:
    normalized_question = _normalize_space(question)
    if session is None or not _is_follow_up_question(normalized_question):
        return normalized_question

    ordered_messages = sorted(session.messages, key=lambda item: item.message_index)
    recent_user_messages = [
        _normalize_space(message.content)
        for message in ordered_messages
        if message.role == "user" and _normalize_space(message.content) != normalized_question
    ]
    prior_user_context = recent_user_messages[-2:]
    context_parts = [part for part in [session.category, *prior_user_context, normalized_question] if part]
    return " / ".join(dict.fromkeys(context_parts))


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


def _build_document_path(source_file: str | None) -> str | None:
    if not source_file or str(source_file).startswith("seed:"):
        return None
    return f"/api/v1/chat/documents/view?source_file={quote(str(source_file))}"


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


def _build_answer_sections(
    question: str,
    primary_chunk: KnowledgeChunk,
    category: str,
    chunks: Sequence[tuple[KnowledgeChunk, float]],
) -> list[AnswerSectionResponse]:
    citation = _build_citation(primary_chunk)
    focus_excerpt = _extract_focus_excerpt(primary_chunk)
    category_hint = {
        "임금/수당": "임금의 산정 기준과 실제 지급 방식이 조문 취지에 맞는지 먼저 살펴보는 것이 좋습니다.",
        "근로시간/휴가": "휴일, 휴가, 근로시간 산정 기준이 어떻게 연결되는지 중심으로 보시는 편이 좋습니다.",
        "고용보장/해고": "해고 사유와 절차가 법 기준에 맞는지 순서대로 점검해 보셔야 합니다.",
        "일·가정 양립": "휴직 요건, 사용 기간, 불이익 금지 여부를 함께 확인하시는 것이 중요합니다.",
    }.get(category, "사실관계와 조문 기준을 함께 맞춰 보시는 것이 중요합니다.")

    rule_body = f"우선 기준이 되는 조문은 {citation}입니다. {category_hint}"
    if focus_excerpt:
        rule_body = f"{rule_body} 조문상 핵심은 다음과 같습니다. {focus_excerpt}"

    application_body = (
        f"질문하신 내용은 '{_normalize_space(question)}'인데, "
        "이 조문이 그대로 적용되는지는 근로형태, 실제 근무 방식, 회사의 운영 방식까지 함께 봐야 합니다."
    )
    risk_body = (
        "사실관계가 더 필요하거나 검색된 조문만으로 단정하기 어려운 부분은 추가 자료를 확인한 뒤 판단하는 편이 안전합니다."
    )

    section_chunk_ids = [primary_chunk.chunk_id]
    if len(chunks) > 1:
        section_chunk_ids.extend(chunk.chunk_id for chunk, _ in chunks[1:3])

    sections = [
        AnswerSectionResponse(
            heading="핵심 기준",
            body=rule_body,
            citation=citation,
            source_chunk_ids=[primary_chunk.chunk_id],
        ),
        AnswerSectionResponse(
            heading="질문에의 적용",
            body=application_body,
            citation=citation,
            source_chunk_ids=section_chunk_ids,
        ),
        AnswerSectionResponse(
            heading="주의할 점",
            body=risk_body,
            citation=citation,
            source_chunk_ids=[primary_chunk.chunk_id],
        ),
    ]
    return sections


def _build_assistant_text(
    summary: str,
    answer_sections: Sequence[AnswerSectionResponse],
    guidance: list[str],
    primary_citation: str | None,
    question: str,
    action_items: dict[str, list[str]] | None = None,
) -> str:
    lines = [summary]
    for section in answer_sections:
        lines.extend(["", f"[{section.heading}] {section.body}"])
        if section.citation:
            lines.append(f"근거: {section.citation}")
    lines.extend(["", "참고하실 점", *(f"- {item}" for item in guidance)])
    if action_items:
        next_actions = action_items.get("next_actions", [])
        required_docs = action_items.get("required_docs", [])
        deadlines = action_items.get("deadlines", [])
        if next_actions:
            lines.extend(["", "먼저 할 일", *(f"- {item}" for item in next_actions[:3])])
        if required_docs:
            lines.extend(["", "준비할 서류", *(f"- {item}" for item in required_docs[:5])])
        if deadlines:
            lines.extend(["", "권장 기한", *(f"- {item}" for item in deadlines[:3])])
    if primary_citation:
        lines.extend(["", f"주요 근거 조문: {primary_citation}"])
    lines.extend(["", f"질문 내용: {question}"])
    return "\n".join(lines)


def _build_llm_prompt_context(chunks: Sequence[tuple[KnowledgeChunk, float]]) -> str:
    lines: list[str] = []
    for index, (chunk, score) in enumerate(chunks, start=1):
        lines.append(f"[{index}] citation: {_build_citation(chunk)}")
        lines.append(f"[{index}] source_label: {_build_source_label(chunk)}")
        lines.append(f"[{index}] relevance_score: {round(score, 2)}")
        lines.append(f"[{index}] excerpt: {_extract_focus_excerpt(chunk)}")
        lines.append("")
    return "\n".join(lines).strip()


def _normalize_user_context(user_context: dict[str, str | None] | None) -> dict[str, str]:
    if not user_context:
        return {}
    normalized: dict[str, str] = {}
    for key, value in user_context.items():
        if value is None:
            continue
        compact = _normalize_space(str(value))
        if compact:
            normalized[key] = compact
    return normalized


def _format_user_context_for_prompt(user_context: dict[str, str]) -> str:
    if not user_context:
        return "없음"
    lines = [f"- {key}: {value}" for key, value in user_context.items()]
    return "\n".join(lines)


def _parse_user_id(user_id: str | None) -> uuid.UUID | None:
    if not user_id:
        return None
    try:
        return uuid.UUID(str(user_id))
    except ValueError:
        return None


def _extract_action_items(
    category: str,
    question: str,
    structured_answer: StructuredAnswerResponse,
) -> dict[str, list[str]]:
    next_actions = [
        "오늘 상담 내용을 기준으로 사실관계를 3줄로 정리하세요.",
        "핵심 쟁점과 회사/근로자 입장을 분리해 메모해 두세요.",
    ]
    if structured_answer.guidance:
        next_actions.extend(structured_answer.guidance[:2])

    q = _normalize_space(question)
    required_docs_by_intent = [
        (
            ("해고", "해고예고", "권고사직", "징계", "부당해고"),
            ["해고통지서 또는 안내문", "인사평가/징계 관련 문서", "취업규칙(징계/해고 조항)", "근로계약서"],
        ),
        (
            ("임금", "월급", "급여", "체불", "지연이자", "퇴직금", "주휴"),
            ["근로계약서", "급여명세서", "임금지급내역(통장입금내역)", "출퇴근기록"],
        ),
        (
            ("연차", "휴가", "휴일", "휴게", "근로시간", "연장근로"),
            ["출퇴근기록", "근무표", "연차신청/승인기록", "취업규칙(휴가/근로시간 조항)"],
        ),
    ]
    required_docs: list[str] | None = None
    for keywords, docs in required_docs_by_intent:
        if any(keyword in q for keyword in keywords):
            required_docs = docs
            break

    if required_docs is None:
        required_docs = {
            "임금/수당": ["근로계약서", "급여명세서", "임금지급내역(통장입금내역)"],
            "근로시간/휴가": ["출퇴근기록", "근무표", "연차신청/승인기록"],
            "고용보장/해고": ["해고통지서 또는 안내문", "인사평가/징계 관련 문서", "근로계약서"],
            "일·가정 양립": ["육아휴직 신청서", "회사 승인/거절 회신", "취업규칙 관련 조항"],
        }.get(category, ["근로계약서", "회사 공지/안내문", "관련 대화 기록"])

    deadlines: list[str] = []
    if any(keyword in q for keyword in ("해고", "징계", "권고사직", "체불")):
        deadlines.append("증빙 자료를 24시간 내 1차 정리")
    if "연차" in q or "휴가" in q:
        deadlines.append("휴가 관련 자료를 이번 주 내 정리")
    if not deadlines:
        deadlines.append("상담 후 3일 내 관련 자료를 정리")

    return {
        "next_actions": list(dict.fromkeys(next_actions[:3])),
        "required_docs": required_docs,
        "deadlines": deadlines,
    }


def _create_auto_notifications(
    db: Session,
    user_uuid: uuid.UUID | None,
    chat_session_uuid: uuid.UUID,
    category: str,
    summary: str,
    action_items: dict[str, list[str]],
) -> None:
    if user_uuid is None:
        return

    next_actions = action_items.get("next_actions", [])
    required_docs = action_items.get("required_docs", [])
    deadlines = action_items.get("deadlines", [])

    summary_lines = [_clip_excerpt(_normalize_space(summary), limit=160)]
    if next_actions:
        summary_lines.append(f"우선순위 1: {next_actions[0]}")
    if deadlines:
        summary_lines.append(f"권장 기한: {deadlines[0]}")

    summary_title = {
        "고용보장/해고": "해고/징계 상담 요약",
        "임금/수당": "임금 상담 요약",
        "근로시간/휴가": "연차·근로시간 상담 요약",
        "일·가정 양립": "육아·휴직 상담 요약",
    }.get(category, "오늘 상담 요약")

    summary_alert = UserNotification(
        user_id=user_uuid,
        title=summary_title,
        content="\n".join(summary_lines),
        source="chat_auto",
        alert_type="summary",
        chat_session_id=str(chat_session_uuid),
        due_date=datetime.now(UTC) + timedelta(days=1),
        is_read=False,
    )
    db.add(summary_alert)

    docs_text = "확인 필요 서류:\n" + "\n".join(f"- {doc}" for doc in required_docs[:5])
    docs_title = {
        "고용보장/해고": "해고/징계 서류 체크",
        "임금/수당": "임금 증빙 서류 체크",
        "근로시간/휴가": "연차·근로시간 서류 체크",
        "일·가정 양립": "육아·휴직 서류 체크",
    }.get(category, "필요 서류 체크")

    docs_alert = UserNotification(
        user_id=user_uuid,
        title=docs_title,
        content=docs_text,
        source="chat_auto",
        alert_type="document",
        chat_session_id=str(chat_session_uuid),
        due_date=datetime.now(UTC) + timedelta(days=3),
        is_read=False,
    )
    db.add(docs_alert)


def _extract_json_payload(raw: str) -> dict[str, object] | None:
    if not raw:
        return None
    content = raw.strip()
    try:
        parsed = json.loads(content)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    fenced_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, flags=re.DOTALL)
    if fenced_match:
        try:
            parsed = json.loads(fenced_match.group(1))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    first = content.find("{")
    last = content.rfind("}")
    if first >= 0 and last > first:
        try:
            parsed = json.loads(content[first : last + 1])
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _sanitize_llm_payload(
    payload: dict[str, object],
    allowed_citations: set[str],
) -> dict[str, object] | None:
    summary = str(payload.get("summary", "")).strip()
    caution = str(payload.get("caution", "")).strip()

    raw_sections = payload.get("answer_sections")
    sections: list[dict[str, str]] = []
    if isinstance(raw_sections, list):
        for item in raw_sections[:3]:
            if not isinstance(item, dict):
                continue
            heading = str(item.get("heading", "")).strip()
            body = str(item.get("body", "")).strip()
            citation = str(item.get("citation", "")).strip()
            if not body:
                continue
            if heading not in _ALLOWED_SECTION_HEADINGS:
                continue
            if citation and citation not in allowed_citations:
                citation = ""
            sections.append({"heading": heading, "body": body, "citation": citation})

    raw_guidance = payload.get("guidance")
    guidance: list[str] = []
    if isinstance(raw_guidance, list):
        guidance = [str(item).strip() for item in raw_guidance if str(item).strip()]

    if not sections and not summary:
        return None
    return {
        "summary": summary,
        "answer_sections": sections,
        "guidance": guidance,
        "caution": caution,
    }


def _generate_llm_answer_payload(
    question: str,
    category: str,
    chunks: Sequence[tuple[KnowledgeChunk, float]],
    user_context: dict[str, str] | None = None,
) -> dict[str, object] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    model_name = os.getenv("OPENAI_CHAT_MODEL", DEFAULT_CHAT_MODEL)
    client = OpenAI(api_key=api_key)
    context = _build_llm_prompt_context(chunks)
    context_text = _format_user_context_for_prompt(user_context or {})
    citations = list(dict.fromkeys(_build_citation(chunk) for chunk, _ in chunks))

    system_prompt = (
        "당신은 근거 기반 노동법 상담 도우미입니다. "
        "반드시 제공된 근거 문맥만 사용해 설명하세요. "
        "단정적 법률자문처럼 말하지 말고 사실관계에 따른 변동 가능성을 명시하세요."
    )
    user_prompt = (
        f"질문: {question}\n"
        f"분류: {category}\n"
        f"사용자 맥락:\n{context_text}\n"
        f"사용 가능한 근거(citation/excerpt):\n{context}\n\n"
        "아래 JSON 스키마로만 답하세요. 마크다운/설명문 금지.\n"
        "{\n"
        '  "summary": "string",\n'
        '  "answer_sections": [{"heading":"핵심 기준|질문에의 적용|주의할 점","body":"string","citation":"string"}],\n'
        '  "guidance": ["string", "string", "string"],\n'
        '  "caution": "string"\n'
        "}\n"
        f"citation은 반드시 이 목록에서만 선택: {citations}"
    )

    allowed_citations = set(citations)
    for _ in range(LLM_MAX_RETRIES):
        try:
            response = client.responses.create(
                model=model_name,
                temperature=0.2,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            content = (response.output_text or "").strip()
            parsed = _extract_json_payload(content)
            if not parsed:
                continue
            sanitized = _sanitize_llm_payload(parsed, allowed_citations)
            if sanitized:
                return sanitized
        except Exception:
            continue
    return None


def _build_structured_answer(
    question: str,
    category: str,
    chunks: Sequence[tuple[KnowledgeChunk, float]],
    user_context: dict[str, str] | None = None,
) -> tuple[StructuredAnswerResponse, str | None, float, str, dict[str, list[str]]]:
    primary_chunk, primary_score = chunks[0]
    primary_citation = _build_citation(primary_chunk)
    applied_rule = primary_citation

    cited_rules = list(dict.fromkeys(_build_citation(chunk) for chunk, _ in chunks))
    llm_payload = _generate_llm_answer_payload(
        question=question,
        category=category,
        chunks=chunks,
        user_context=user_context,
    )

    if llm_payload:
        raw_sections = llm_payload.get("answer_sections")
        answer_sections: list[AnswerSectionResponse] = []
        if isinstance(raw_sections, list):
            for item in raw_sections[:3]:
                if not isinstance(item, dict):
                    continue
                heading = str(item.get("heading", "")).strip() or "핵심 기준"
                body = str(item.get("body", "")).strip()
                citation = str(item.get("citation", "")).strip() or primary_citation
                if not body:
                    continue
                answer_sections.append(
                    AnswerSectionResponse(
                        heading=heading,
                        body=body,
                        citation=citation,
                        source_chunk_ids=[chunk.chunk_id for chunk, _ in chunks],
                    )
                )

        if not answer_sections:
            answer_sections = _build_answer_sections(question, primary_chunk, category, chunks)

        summary = str(llm_payload.get("summary", "")).strip() or (
            f"질문 내용은 `{category}` 범주로 보이며, "
            f"우선적으로 {primary_citation}을 확인해 보시는 것이 적절합니다."
        )
        raw_guidance = llm_payload.get("guidance")
        guidance = [str(item).strip() for item in raw_guidance if str(item).strip()] if isinstance(raw_guidance, list) else []
        if not guidance:
            guidance = _build_guidance(chunks)
        caution = str(llm_payload.get("caution", "")).strip() or (
            "개별 사안은 사실관계에 따라 결론이 달라질 수 있으므로, "
            "해고·징계·체불처럼 즉시 대응이 필요한 경우에는 전문 상담과 함께 검토하시는 편이 안전합니다."
        )
    else:
        summary = (
            f"질문 내용은 `{category}` 범주로 보이며, "
            f"우선적으로 {primary_citation}을 확인해 보시는 것이 적절합니다."
        )
        answer_sections = _build_answer_sections(question, primary_chunk, category, chunks)
        guidance = _build_guidance(chunks)
        caution = (
            "개별 사안은 사실관계에 따라 결론이 달라질 수 있으므로, "
            "해고·징계·체불처럼 즉시 대응이 필요한 경우에는 전문 상담과 함께 검토하시는 편이 안전합니다."
        )

    answer = "\n\n".join(
        f"[{section.heading}] {section.body}\n근거: {section.citation}"
        if section.citation
        else f"[{section.heading}] {section.body}"
        for section in answer_sections
    )

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

    action_items = _extract_action_items(
        category=category,
        question=question,
        structured_answer=StructuredAnswerResponse(
            summary=summary,
            answer=answer,
            answer_sections=answer_sections,
            guidance=guidance,
            caution=caution,
            cited_rules=cited_rules,
            primary_citation=primary_citation,
            sources=sources,
        ),
    )

    assistant_text = _build_assistant_text(
        summary=summary,
        answer_sections=answer_sections,
        guidance=guidance,
        primary_citation=primary_citation,
        question=question,
        action_items=action_items,
    )
    if user_context:
        context_lines = [f"- {key}: {value}" for key, value in user_context.items()]
        assistant_text = f"{assistant_text}\n\n사용자 맥락\n" + "\n".join(context_lines)

    structured_response = StructuredAnswerResponse(
        summary=summary,
        answer=answer,
        answer_sections=answer_sections,
        guidance=guidance,
        caution=caution,
        cited_rules=cited_rules,
        primary_citation=primary_citation,
        sources=sources,
    )

    return (
        structured_response,
        applied_rule,
        round(max(primary_score, 0.3), 2),
        assistant_text,
        action_items,
    )


def process_chat_message(
    db: Session,
    content: str,
    chat_session_id: str | None = None,
    user_id: str | None = None,
    user_context: dict[str, str | None] | None = None,
    evidence_context: list[dict[str, str]] | None = None,
) -> ChatResponse:
    content = content.strip()
    if not content:
        raise ValueError("content must not be empty")

    session = None
    if chat_session_id:
        session_uuid = _parse_chat_session_id(chat_session_id)
        session = db.query(ChatSession).filter(ChatSession.chat_session_id == session_uuid).first()

    normalized_context = _normalize_user_context(user_context)
    evidence_context = evidence_context or []
    evidence_lines: list[str] = []
    if evidence_context:
        evidence_lines = [
            f"파일: {item.get('filename', '-')}, 카테고리: {item.get('category', '-')}, 설명: {item.get('description', '-')}"
            for item in evidence_context[:5]
        ]
    effective_content = content if not evidence_lines else f"{content}\n\n첨부 증거:\n" + "\n".join(f"- {line}" for line in evidence_lines)

    search_query = _build_search_query(effective_content, session)
    chunks = search_knowledge(search_query, top_k=3, user_context=normalized_context)
    if not chunks:
        raise ValueError("현재 검색 가능한 문서가 없어 상담 로직을 진행할 수 없습니다.")
    category = _choose_category(effective_content, chunks)
    risk_level = _choose_risk_level(effective_content)
    user_uuid = _parse_user_id(user_id)

    if session is None:
        session = ChatSession(
            user_id=user_uuid,
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
        if session.user_id is None and user_uuid is not None:
            session.user_id = user_uuid

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

    structured_answer, applied_rule, confidence_score, answer_text, action_items = _build_structured_answer(
        effective_content,
        category,
        chunks,
        user_context=normalized_context,
    )
    if evidence_lines:
        answer_text = f"{answer_text}\n\n검토한 첨부 증거\n" + "\n".join(f"- {line}" for line in evidence_lines)

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

    _create_auto_notifications(
        db=db,
        user_uuid=session.user_id or user_uuid,
        chat_session_uuid=session.chat_session_id,
        category=category,
        summary=structured_answer.summary,
        action_items=action_items,
    )

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
                citation=_build_citation(chunk),
                source_label=_build_source_label(chunk),
            )
            for trace, (chunk, _score) in zip(traces, chunks, strict=False)
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
        latest_assistant = next((message for message in reversed(messages) if message.role == "assistant"), None)
        latest_sources = _build_sources_from_traces(latest_assistant.answer_traces) if latest_assistant is not None else []
        items.append(
            ChatSessionSummaryResponse(
                chat_session_id=str(session.chat_session_id),
                title=session.title,
                category=session.category,
                risk_level=session.risk_level,
                summary=session.summary,
                last_message_preview=_build_message_preview(last_message),
                latest_primary_citation=latest_sources[0].citation if latest_sources else None,
                latest_source_label=latest_sources[0].source_label if latest_sources else None,
                message_count=len(messages),
                created_at=session.created_at,
                updated_at=session.updated_at,
            )
        )

    return ChatSessionListResponse(sessions=items)


def _chunk_index() -> dict[int, KnowledgeChunk]:
    return {chunk.chunk_id: chunk for chunk in load_knowledge_base()}


def _build_sources_from_traces(traces: Sequence[AnswerTrace]) -> list[AnswerSourceResponse]:
    chunk_index = _chunk_index()
    sources: list[AnswerSourceResponse] = []
    for trace in sorted(traces, key=lambda item: (item.step_order or 9999, item.trace_id)):
        if trace.chunk_id is None:
            continue
        chunk = chunk_index.get(trace.chunk_id)
        if chunk is None:
            continue
        sources.append(
            AnswerSourceResponse(
                chunk_id=chunk.chunk_id,
                title=chunk.title,
                source_file=chunk.source_file,
                document_path=_build_document_path(chunk.source_file),
                article_number=chunk.article_number,
                page_number=chunk.page_number,
                source_label=_build_source_label(chunk),
                citation=_build_citation(chunk),
                excerpt=_extract_focus_excerpt(chunk),
                relevance_score=trace.relevance_score,
            )
        )
    return sources


def _build_trace_responses(traces: Sequence[AnswerTrace]) -> list[AnswerTraceResponse]:
    chunk_index = _chunk_index()
    items: list[AnswerTraceResponse] = []
    for trace in sorted(traces, key=lambda item: (item.step_order or 9999, item.trace_id)):
        chunk = chunk_index.get(trace.chunk_id) if trace.chunk_id is not None else None
        items.append(
            AnswerTraceResponse(
                chunk_id=trace.chunk_id,
                step_order=trace.step_order,
                logic_type=trace.logic_type,
                relevance_score=trace.relevance_score,
                citation=_build_citation(chunk) if chunk is not None else None,
                source_label=_build_source_label(chunk) if chunk is not None else None,
            )
        )
    return items


def _wrap_report_text(text: str, limit: int = 34) -> list[str]:
    normalized = _normalize_space(text)
    if not normalized:
        return []
    words = normalized.split(" ")
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= limit:
            current = candidate
            continue
        if current:
            lines.append(current)
            current = ""
        while len(word) > limit:
            lines.append(word[:limit])
            word = word[limit:]
        current = word
    if current:
        lines.append(current)
    return lines


def _pdf_hex_text(text: str) -> str:
    return text.encode("utf-16-be").hex().upper()


def _build_simple_pdf(pages: list[list[str]]) -> bytes:
    objects: list[bytes] = []

    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")

    page_object_numbers = [5 + index * 2 for index in range(len(pages))]
    kids = " ".join(f"{number} 0 R" for number in page_object_numbers)
    objects.append(f"<< /Type /Pages /Count {len(pages)} /Kids [{kids}] >>".encode("ascii"))

    objects.append(
        b"<< /Type /Font /Subtype /Type0 /BaseFont /HYGoThic-Medium /Encoding /UniKS-UCS2-H /DescendantFonts [4 0 R] >>"
    )
    objects.append(
        b"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HYGoThic-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (Korea1) /Supplement 1 >> /DW 1000 >>"
    )

    for page_index, lines in enumerate(pages):
        page_number = 5 + page_index * 2
        content_number = page_number + 1
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_number} 0 R >>".encode(
                "ascii"
            )
        )
        content_lines = ["BT", "/F1 11 Tf", "15 TL"]
        y = 790
        for line in lines:
            safe_line = _pdf_hex_text(line)
            content_lines.append(f"1 0 0 1 48 {y} Tm <{safe_line}> Tj")
            y -= 18
        content_lines.append("ET")
        stream = "\n".join(content_lines).encode("ascii")
        objects.append(b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream")

    buffer = BytesIO()
    buffer.write(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(buffer.tell())
        buffer.write(f"{index} 0 obj\n".encode("ascii"))
        buffer.write(obj)
        buffer.write(b"\nendobj\n")

    xref_pos = buffer.tell()
    buffer.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    buffer.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        buffer.write(f"{offset:010d} 00000 n \n".encode("ascii"))
    buffer.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF".encode("ascii")
    )
    return buffer.getvalue()


def generate_chat_session_report(db: Session, chat_session_id: str, requester_user_id: str) -> tuple[str, bytes]:
    session_uuid = _parse_chat_session_id(chat_session_id)
    requester_uuid = _parse_user_id(requester_user_id)
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
    if requester_uuid is None:
        raise ValueError("유효한 사용자 정보가 필요합니다.")
    if session.user_id is not None and session.user_id != requester_uuid:
        raise ValueError("리포트를 내려받을 권한이 없는 상담 세션입니다.")

    ordered_messages = sorted(session.messages, key=lambda item: item.message_index)
    latest_assistant = next((message for message in reversed(ordered_messages) if message.role == "assistant"), None)
    latest_user = next((message for message in reversed(ordered_messages) if message.role == "user"), None)
    latest_sources = _build_sources_from_traces(latest_assistant.answer_traces) if latest_assistant is not None else []

    raw_lines = [
        "노무톡톡 상담 리포트",
        "",
        f"상담 제목: {session.title or '노무 상담'}",
        f"생성일: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}",
        f"카테고리: {session.category or 'AI 상담'}",
        f"위험도: {session.risk_level or '-'}",
        "",
        "상담 요약",
        session.summary or "저장된 요약이 없습니다.",
        "",
        "최근 사용자 질문",
        latest_user.content if latest_user is not None else "기록이 없습니다.",
        "",
        "최근 AI 답변",
        latest_assistant.content if latest_assistant is not None else "기록이 없습니다.",
        "",
        "핵심 근거",
    ]
    if latest_sources:
        for source in latest_sources[:5]:
            raw_lines.append(f"- {source.citation or source.title or '참조문서'}")
            if source.source_label:
                raw_lines.append(f"  출처: {source.source_label}")
            if source.excerpt:
                raw_lines.append(f"  발췌: {source.excerpt}")
    else:
        raw_lines.append("저장된 근거 정보가 없습니다.")

    raw_lines.extend(
        [
            "",
            "안내",
            DISCLAIMER,
        ]
    )

    flattened_lines: list[str] = []
    for entry in raw_lines:
        if entry == "":
            flattened_lines.append("")
            continue
        flattened_lines.extend(_wrap_report_text(entry))

    pages: list[list[str]] = []
    current_page: list[str] = []
    for line in flattened_lines:
        if len(current_page) >= 38:
            pages.append(current_page)
            current_page = []
        current_page.append(line)
    if current_page:
        pages.append(current_page)

    pdf_bytes = _build_simple_pdf(pages or [["노무톡톡 상담 리포트"]])
    filename = f"nomutalktalk-report-{str(session.chat_session_id)[:8]}.pdf"
    return filename, pdf_bytes


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
    latest_assistant = next((message for message in reversed(ordered_messages) if message.role == "assistant"), None)
    latest_sources: list[AnswerSourceResponse] = []
    latest_answer_meta = None
    latest_answer_traces: list[AnswerTraceResponse] = []
    latest_primary_citation = None

    if latest_assistant is not None:
        latest_sources = _build_sources_from_traces(latest_assistant.answer_traces)
        latest_answer_traces = _build_trace_responses(latest_assistant.answer_traces)
        latest_primary_citation = latest_sources[0].citation if latest_sources else None
        if latest_assistant.answer_meta is not None:
            latest_answer_meta = AnswerMetaResponse(
                disclaimer=latest_assistant.answer_meta.disclaimer,
                applied_rule=latest_assistant.answer_meta.applied_rule,
                confidence_score=latest_assistant.answer_meta.confidence_score,
            )

    return ChatSessionDetailResponse(
        chat_session_id=str(session.chat_session_id),
        title=session.title,
        category=session.category,
        risk_level=session.risk_level,
        summary=session.summary,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[_serialize_message(message) for message in ordered_messages],
        latest_sources=latest_sources,
        latest_answer_meta=latest_answer_meta,
        latest_answer_traces=latest_answer_traces,
        latest_primary_citation=latest_primary_citation,
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


def delete_chat_session(db: Session, chat_session_id: str, requester_user_id: str) -> dict[str, str]:
    session_uuid = _parse_chat_session_id(chat_session_id)
    requester_uuid = _parse_user_id(requester_user_id)
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

    if requester_uuid is None:
        raise ValueError("유효한 사용자 정보가 필요합니다.")

    if session.user_id is not None and session.user_id != requester_uuid:
        raise ValueError("삭제할 수 없는 상담 세션입니다.")

    session.is_deleted = True
    db.commit()
    return {"status": "deleted", "chat_session_id": str(session.chat_session_id)}
