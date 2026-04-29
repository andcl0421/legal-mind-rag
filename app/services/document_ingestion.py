from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.services.embedding_service import dumps_vector, embed_text

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    PdfReader = None


ROOT_DIR = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT_DIR / "data" / "raw"
PROCESSED_DIR = ROOT_DIR / "data" / "processed"
PROCESSED_CHUNKS_PATH = PROCESSED_DIR / "knowledge_chunks.json"

ARTICLE_HEADER_PATTERN = re.compile(r"(제\s*\d+\s*조(?:의\s*\d+)?)\s*\(")


@dataclass(frozen=True)
class ProcessedChunk:
    chunk_id: int
    source_file: str
    source_type: str
    title: str
    category: str
    content: str
    page_number: int | None = None
    article_number: str | None = None


SUPPORTED_EXTENSIONS = {".txt", ".md", ".json", ".pdf"}

CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "임금/수당": ("임금", "주휴", "퇴직금", "수당", "체불", "급여"),
    "근로시간/휴가": ("휴게", "휴일", "근로시간", "52시간", "연차", "연장근로"),
    "고용보장/해고": ("해고", "부당해고", "징계", "권고사직", "실업급여"),
    "일·가정 양립": ("육아휴직", "육아", "임신", "출산", "복직", "유연근무"),
}


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _guess_category(text: str) -> str:
    lowered = text.lower()
    scores: dict[str, int] = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        scores[category] = sum(1 for keyword in keywords if keyword.lower() in lowered)

    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "일반 상담"


def _normalize_article_number(raw_article: str | None) -> str | None:
    if not raw_article:
        return None
    normalized = re.sub(r"\s+", "", raw_article)
    normalized = normalized.replace("의", "의")
    return normalized


def _extract_article_number(text: str) -> str | None:
    match = ARTICLE_HEADER_PATTERN.search(text)
    if not match:
        return None
    return _normalize_article_number(match.group(1))


def _chunk_text(text: str, chunk_size: int = 650, overlap: int = 120) -> list[str]:
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


def _chunk_article_text(text: str) -> list[str]:
    normalized = _normalize_text(text)
    if not normalized:
        return []
    if len(normalized) <= 700:
        return [normalized]
    return _chunk_text(normalized, chunk_size=700, overlap=140)


def _read_raw_file(path: Path) -> str:
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            return _normalize_text(json.dumps(payload, ensure_ascii=False))
        if isinstance(payload, list):
            return _normalize_text(" ".join(json.dumps(item, ensure_ascii=False) for item in payload))
    return _normalize_text(path.read_text(encoding="utf-8", errors="ignore"))


def _read_pdf_pages(path: Path) -> list[tuple[int, str]]:
    if PdfReader is None:
        raise RuntimeError("PDF parser not available")

    reader = PdfReader(str(path))
    page_texts: list[tuple[int, str]] = []
    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        normalized = _normalize_text(page_text)
        if normalized:
            page_texts.append((page_number, normalized))
    return page_texts


def _split_article_sections(text: str) -> list[tuple[str | None, str]]:
    matches = list(ARTICLE_HEADER_PATTERN.finditer(text))
    if not matches:
        return [(None, text)]

    sections: list[tuple[str | None, str]] = []
    if matches[0].start() > 0:
        preamble = text[: matches[0].start()].strip()
        if preamble:
            sections.append((None, preamble))

    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        article_text = text[start:end].strip()
        if article_text:
            sections.append((_normalize_article_number(match.group(1)), article_text))

    return sections


def _iter_pdf_article_segments(path: Path) -> list[tuple[str, int | None, str | None]]:
    pages = _read_pdf_pages(path)
    segments: list[tuple[str, int | None, str | None]] = []

    carry_article_number: str | None = None
    carry_text_parts: list[str] = []
    carry_page_number: int | None = None

    def flush_carry() -> None:
        nonlocal carry_article_number, carry_text_parts, carry_page_number
        if carry_text_parts:
            merged_text = _normalize_text(" ".join(carry_text_parts))
            if merged_text:
                segments.append((merged_text, carry_page_number, carry_article_number))
        carry_article_number = None
        carry_text_parts = []
        carry_page_number = None

    for page_number, page_text in pages:
        sections = _split_article_sections(page_text)
        if not sections:
            continue

        for article_number, section_text in sections:
            normalized_text = _normalize_text(section_text)
            if not normalized_text:
                continue

            if article_number is None:
                if carry_article_number is not None:
                    carry_text_parts.append(normalized_text)
                else:
                    segments.append((normalized_text, page_number, None))
                continue

            if carry_article_number is not None and article_number != carry_article_number:
                flush_carry()

            if carry_article_number is None:
                carry_article_number = article_number
                carry_page_number = page_number
                carry_text_parts = [normalized_text]
            else:
                carry_text_parts.append(normalized_text)

    flush_carry()
    return segments


def _iter_document_segments(path: Path) -> list[tuple[str, int | None, str | None]]:
    if path.suffix.lower() == ".pdf":
        return _iter_pdf_article_segments(path)
    return [(_read_raw_file(path), None, None)]


def ingest_raw_documents() -> dict[str, int | list[str]]:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    chunks: list[ProcessedChunk] = []
    skipped_files: list[str] = []
    chunk_id = 2000

    for path in sorted(RAW_DIR.rglob("*")):
        if not path.is_file():
            continue

        suffix = path.suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            skipped_files.append(f"{path.name}: 지원하지 않는 형식")
            continue

        try:
            segments = _iter_document_segments(path)
        except RuntimeError as exc:
            skipped_files.append(f"{path.name}: {exc}")
            continue
        except Exception as exc:  # pragma: no cover
            skipped_files.append(f"{path.name}: 읽기 실패 ({exc})")
            continue

        title = path.stem
        segment_has_content = False
        for text, page_number, article_number in segments:
            if not text:
                continue
            segment_has_content = True
            category = _guess_category(text)

            for piece in _chunk_article_text(text):
                chunks.append(
                    ProcessedChunk(
                        chunk_id=chunk_id,
                        source_file=path.name,
                        source_type="raw",
                        title=title,
                        category=category,
                        content=piece,
                        page_number=page_number,
                        article_number=article_number or _extract_article_number(piece),
                    )
                )
                chunk_id += 1

        if not segment_has_content:
            skipped_files.append(f"{path.name}: 내용 없음")

    PROCESSED_CHUNKS_PATH.write_text(
        json.dumps([asdict(chunk) for chunk in chunks], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return {
        "ingested_chunk_count": len(chunks),
        "source_file_count": len({chunk.source_file for chunk in chunks}),
        "skipped_files": skipped_files,
    }


def load_processed_chunks() -> list[ProcessedChunk]:
    if not PROCESSED_CHUNKS_PATH.exists():
        return []

    payload = json.loads(PROCESSED_CHUNKS_PATH.read_text(encoding="utf-8"))
    return [ProcessedChunk(**item) for item in payload]


def persist_processed_chunks_to_db(db: Session) -> dict[str, int]:
    from app.models import Document, DocumentChunk, DocumentChunkEmbedding

    processed_chunks = load_processed_chunks()
    raw_document_ids = [
        document_id
        for (document_id,) in db.query(Document.document_id).filter(Document.source_type == "raw").all()
    ]

    if raw_document_ids:
        db.query(DocumentChunkEmbedding).filter(
            DocumentChunkEmbedding.chunk_id.in_(
                db.query(DocumentChunk.chunk_id).filter(DocumentChunk.document_id.in_(raw_document_ids))
            )
        ).delete(synchronize_session=False)
        db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(raw_document_ids)).delete(
            synchronize_session=False
        )
        db.query(Document).filter(Document.document_id.in_(raw_document_ids)).delete(synchronize_session=False)
        db.commit()
        db.expunge_all()

    if not processed_chunks:
        return {"document_count": 0, "chunk_count": 0}

    chunks_by_source: dict[str, list[ProcessedChunk]] = {}
    for chunk in processed_chunks:
        chunks_by_source.setdefault(chunk.source_file, []).append(chunk)

    chunk_count = 0
    for file_chunks in chunks_by_source.values():
        first_chunk = file_chunks[0]
        document = Document(
            title=first_chunk.title,
            source_type=first_chunk.source_type,
            source_file=first_chunk.source_file,
            category=first_chunk.category,
        )
        db.add(document)
        db.flush()

        for chunk in file_chunks:
            document_chunk = DocumentChunk(
                chunk_id=chunk.chunk_id,
                document_id=document.document_id,
                content=chunk.content,
                page_number=chunk.page_number,
                article_number=chunk.article_number,
                source_type=chunk.source_type,
                category=chunk.category,
            )
            db.add(document_chunk)

            model_name, vector = embed_text(
                f"{document.title} {chunk.article_number or ''} {chunk.category or ''} {chunk.content}"
            )
            db.add(
                DocumentChunkEmbedding(
                    chunk_id=chunk.chunk_id,
                    model_name=model_name,
                    vector_json=dumps_vector(vector),
                )
            )
            chunk_count += 1

    db.commit()
    return {"document_count": len(chunks_by_source), "chunk_count": chunk_count}
