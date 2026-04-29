from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.database.session import SessionLocal
from app.services.embedding_service import cosine_similarity, embed_text, loads_vector
from app.services.document_ingestion import PROCESSED_CHUNKS_PATH


ROOT_DIR = Path(__file__).resolve().parents[2]
DOCS_DIR = ROOT_DIR / "docs"


@dataclass(frozen=True)
class KnowledgeChunk:
    chunk_id: int
    category: str
    title: str
    rule_label: str
    content: str
    source_file: str
    source_type: str
    article_number: str | None = None
    page_number: int | None = None
    embedding_vector: list[float] | None = None
    embedding_model: str | None = None


SEED_KNOWLEDGE_BASE: tuple[KnowledgeChunk, ...] = (
    KnowledgeChunk(
        chunk_id=101,
        category="임금/수당",
        title="주휴수당 기본 요건",
        rule_label="주휴수당 기본 요건",
        content="주휴수당은 통상 주 소정근로일을 개근한 근로자에게 검토되며, 실제 적용 여부는 소정근로시간과 근로계약 형태를 함께 봐야 합니다.",
        source_file="seed:임금수당",
        source_type="seed",
    ),
    KnowledgeChunk(
        chunk_id=102,
        category="임금/수당",
        title="퇴직금 판단 기준",
        rule_label="퇴직금 기본 판단 기준",
        content="퇴직금은 계속근로기간, 평균임금, 실제 근무관계를 함께 검토해야 하며 근무기간과 근로조건 확인이 핵심입니다.",
        source_file="seed:임금수당",
        source_type="seed",
    ),
    KnowledgeChunk(
        chunk_id=201,
        category="근로시간/휴가",
        title="연차휴가 기본 구조",
        rule_label="연차휴가 기본 구조",
        content="연차휴가는 입사 시점과 출근율에 따라 발생 구조가 달라질 수 있어 1년 미만과 1년 이상 근로자를 구분해 보는 것이 중요합니다.",
        source_file="seed:근로시간휴가",
        source_type="seed",
    ),
    KnowledgeChunk(
        chunk_id=301,
        category="고용보장/해고",
        title="부당해고 기본 판단",
        rule_label="정당한 이유 없는 해고 제한 원칙",
        content="부당해고 여부는 해고 사유의 정당성, 절차 준수, 통지 방식, 징계 근거와 사실관계를 함께 확인해야 판단할 수 있습니다.",
        source_file="seed:고용보장해고",
        source_type="seed",
    ),
    KnowledgeChunk(
        chunk_id=302,
        category="고용보장/해고",
        title="실업급여 확인 포인트",
        rule_label="실업급여 기본 확인 요소",
        content="실업급여는 이직 사유, 고용보험 가입기간, 비자발성 여부 등을 함께 검토해야 하며 자발적 퇴사의 경우도 예외 사유를 확인해야 합니다.",
        source_file="seed:고용보장해고",
        source_type="seed",
    ),
    KnowledgeChunk(
        chunk_id=401,
        category="일·가정 양립",
        title="육아휴직과 급여",
        rule_label="육아휴직 및 급여 기본 구조",
        content="육아휴직은 자녀 연령, 고용보험 요건, 신청 절차, 복직 조건 등을 함께 보아야 하고 급여는 시기와 제도 개편에 따라 달라질 수 있습니다.",
        source_file="seed:일가정양립",
        source_type="seed",
    ),
    KnowledgeChunk(
        chunk_id=402,
        category="일·가정 양립",
        title="임신·출산기 보호",
        rule_label="임신·출산기 보호 제도 기본 원칙",
        content="임신 중 근로시간 단축, 출산전후휴가, 불이익 금지 등은 별도 보호 규정으로 검토해야 하며 일반 근로시간 규정과 구분해서 봐야 합니다.",
        source_file="seed:일가정양립",
        source_type="seed",
    ),
)


_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "임금/수당": ("임금", "주휴", "퇴직금", "수당", "체불", "급여"),
    "근로시간/휴가": ("연차", "휴가", "근로시간", "52시간", "야근", "연장근로"),
    "고용보장/해고": ("해고", "부당해고", "징계", "권고사직", "실업급여"),
    "일·가정 양립": ("육아휴직", "육아", "임신", "출산", "복직", "단축근무"),
}

_STOPWORDS = {
    "이",
    "그",
    "저",
    "및",
    "과",
    "와",
    "을",
    "를",
    "이란",
    "대한",
    "관한",
    "원칙",
    "궁금합니다",
    "알고",
    "싶어요",
    "관련",
    "문의",
    "질문",
}


def _normalize_text(text: str) -> str:
    text = re.sub(r"`+", "", text)
    text = re.sub(r"\!\[[^\]]*\]\([^)]+\)", " ", text)
    text = re.sub(r"\[[^\]]+\]\([^)]+\)", " ", text)
    text = re.sub(r"[#>*\-|]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _choose_category(text: str) -> str:
    scores: dict[str, int] = {}
    lowered = text.lower()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword.lower() in lowered)
        scores[category] = score

    best_category = max(scores, key=scores.get)
    return best_category if scores[best_category] > 0 else "일반 상담"


def _make_chunks(text: str, chunk_size: int = 550, overlap: int = 100) -> list[str]:
    if not text:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


def _load_processed_chunks() -> list[KnowledgeChunk]:
    if not PROCESSED_CHUNKS_PATH.exists():
        return []

    payload = json.loads(PROCESSED_CHUNKS_PATH.read_text(encoding="utf-8"))
    return [
        KnowledgeChunk(
            chunk_id=item["chunk_id"],
            category=item["category"],
            title=item["title"],
            rule_label=item["title"],
            content=item["content"],
            source_file=item["source_file"],
            source_type=item.get("source_type", "raw"),
            article_number=item.get("article_number"),
            page_number=item.get("page_number"),
        )
        for item in payload
    ]


def _load_db_chunks() -> list[KnowledgeChunk]:
    from app.models import Document, DocumentChunk, DocumentChunkEmbedding

    db = SessionLocal()
    try:
        rows = (
            db.query(DocumentChunk, Document, DocumentChunkEmbedding)
            .join(Document, Document.document_id == DocumentChunk.document_id)
            .outerjoin(DocumentChunkEmbedding, DocumentChunkEmbedding.chunk_id == DocumentChunk.chunk_id)
            .order_by(DocumentChunk.chunk_id.asc())
            .all()
        )
        return [
            KnowledgeChunk(
                chunk_id=chunk.chunk_id,
                category=chunk.category or document.category or "일반 상담",
                title=document.title,
                rule_label=document.title,
                content=chunk.content,
                source_file=document.source_file,
                source_type=chunk.source_type,
                article_number=chunk.article_number,
                page_number=chunk.page_number,
                embedding_vector=loads_vector(embedding.vector_json) if embedding else None,
                embedding_model=embedding.model_name if embedding else None,
            )
            for chunk, document, embedding in rows
        ]
    finally:
        db.close()


@lru_cache(maxsize=1)
def load_knowledge_base() -> tuple[KnowledgeChunk, ...]:
    chunks: list[KnowledgeChunk] = list(SEED_KNOWLEDGE_BASE)
    db_chunks = _load_db_chunks()
    if db_chunks:
        chunks.extend(db_chunks)
    else:
        chunks.extend(_load_processed_chunks())

    chunk_id = 1000
    source_files = sorted(DOCS_DIR.glob("*.md"))
    for source_file in source_files:
        if source_file.name.startswith(("05_", "06_", "10_")):
            continue

        raw_text = source_file.read_text(encoding="utf-8", errors="ignore")
        normalized = _normalize_text(raw_text)
        category = _choose_category(normalized)
        title = source_file.stem.replace("_", " ")

        for piece in _make_chunks(normalized):
            chunks.append(
                KnowledgeChunk(
                    chunk_id=chunk_id,
                    category=category,
                    title=title,
                    rule_label=title,
                    content=piece,
                    source_file=source_file.name,
                    source_type="docs",
                )
            )
            chunk_id += 1

    return tuple(chunks)


def refresh_knowledge_base_cache() -> None:
    load_knowledge_base.cache_clear()


def _tokenize(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[0-9A-Za-z가-힣]+", text.lower())
        if len(token) > 1 and token not in _STOPWORDS
    }


def _is_probable_front_matter(chunk: KnowledgeChunk) -> bool:
    if chunk.source_type != "raw" or chunk.article_number:
        return False

    content = chunk.content
    front_matter_markers = (
        "국가법령정보센터",
        "법제처",
        "[시행",
        "고용노동부",
        "일부개정",
        "목적",
    )
    marker_hits = sum(1 for marker in front_matter_markers if marker in content)
    return marker_hits >= 2


def _extract_article_heading(chunk: KnowledgeChunk) -> str:
    if not chunk.article_number:
        return ""

    match = re.search(r"제\s*\d+\s*조(?:의\s*\d+)?\(([^)]+)\)", chunk.content)
    if not match:
        return ""
    return match.group(1).strip()


def search_knowledge(question: str, top_k: int = 3) -> list[tuple[KnowledgeChunk, float]]:
    question_tokens = _tokenize(question)
    _, query_vector = embed_text(question)
    scored: list[tuple[KnowledgeChunk, float, float]] = []

    for chunk in load_knowledge_base():
        chunk_tokens = _tokenize(f"{chunk.title} {chunk.content} {chunk.article_number or ''}")
        overlap = question_tokens & chunk_tokens
        overlap_score = float(len(overlap))
        vector_score = cosine_similarity(query_vector, chunk.embedding_vector) if chunk.embedding_vector else 0.0
        rank_score = overlap_score * 1.5 + (vector_score * 5.0)

        article_bonus = 0.0
        if chunk.article_number and chunk.article_number in question:
            article_bonus = 2.0
            rank_score += article_bonus

        title_bonus = 0.0
        title_tokens = _tokenize(chunk.title)
        title_overlap = question_tokens & title_tokens
        if title_overlap:
            title_bonus = len(title_overlap) * 1.5
            rank_score += title_bonus

        article_heading = _extract_article_heading(chunk)
        heading_tokens = _tokenize(article_heading)
        heading_overlap = question_tokens & heading_tokens
        if heading_overlap:
            rank_score += len(heading_overlap) * 3.0

        if any(keyword.lower() in question.lower() for keyword in _CATEGORY_KEYWORDS.get(chunk.category, ())):
            rank_score += 1.0
        if chunk.source_type == "raw":
            rank_score += 1.0
            if chunk.article_number:
                rank_score += 1.2
            else:
                rank_score -= 1.5
                if _is_probable_front_matter(chunk):
                    rank_score -= 2.0
        elif chunk.source_type == "seed":
            rank_score += 0.3

        if rank_score <= 0:
            continue

        normalized_score = min(rank_score / max((len(question_tokens) * 2.5), 1), 1.0)
        scored.append((chunk, round(normalized_score, 2), rank_score))

    if not scored:
        fallback_chunks = load_knowledge_base()
        if not fallback_chunks:
            return []
        return [(fallback_chunks[0], 0.1)]

    scored.sort(key=lambda item: (item[2], item[1], item[0].chunk_id), reverse=True)
    selected: list[tuple[KnowledgeChunk, float]] = []
    seen_sources: set[tuple[str, str | None]] = set()
    for chunk, normalized_score, _ in scored:
        source_key = (chunk.source_file, chunk.article_number)
        if source_key in seen_sources:
            continue
        selected.append((chunk, normalized_score))
        seen_sources.add(source_key)
        if len(selected) >= top_k:
            break
    return selected
