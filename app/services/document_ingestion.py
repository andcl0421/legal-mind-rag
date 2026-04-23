from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.services.embedding_service import dumps_vector, embed_text

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - optional dependency
    PdfReader = None


ROOT_DIR = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT_DIR / "data" / "raw"
PROCESSED_DIR = ROOT_DIR / "data" / "processed"
PROCESSED_CHUNKS_PATH = PROCESSED_DIR / "knowledge_chunks.json"


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
    "근로시간/휴가": ("연차", "휴가", "근로시간", "52시간", "야근", "연장근로"),
    "고용보장/해고": ("해고", "부당해고", "징계", "권고사직", "실업급여"),
    "일·가정 양립": ("육아휴직", "육아", "임신", "출산", "복직", "단축근무"),
}


def _normalize_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _guess_category(text: str) -> str:
    lowered = text.lower()
    scores: dict[str, int] = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        scores[category] = sum(1 for keyword in keywords if keyword.lower() in lowered)

    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "일반 상담"


def _extract_article_number(text: str) -> str | None:
    match = re.search(r"(제\s*\d+\s*조)", text)
    return match.group(1).replace(" ", "") if match else None


def _chunk_text(text: str, chunk_size: int = 550, overlap: int = 100) -> list[str]:
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
        if page_text.strip():
            page_texts.append((page_number, _normalize_text(page_text)))
    return page_texts


def _iter_document_segments(path: Path) -> list[tuple[str, int | None]]:
    if path.suffix.lower() == ".pdf":
        return [(text, page_number) for page_number, text in _read_pdf_pages(path)]
    return [(_read_raw_file(path), None)]


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
        except Exception as exc:  # pragma: no cover - defensive logging path
            skipped_files.append(f"{path.name}: 읽기 실패 ({exc})")
            continue

        title = path.stem
        segment_has_content = False
        for text, page_number in segments:
            if not text:
                continue
            segment_has_content = True
            category = _guess_category(text)

            for piece in _chunk_text(text):
                chunks.append(
                    ProcessedChunk(
                        chunk_id=chunk_id,
                        source_file=path.name,
                        source_type="raw",
                        title=title,
                        category=category,
                        content=piece,
                        page_number=page_number,
                        article_number=_extract_article_number(piece),
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
    if not processed_chunks:
        return {"document_count": 0, "chunk_count": 0}

    source_files = {chunk.source_file for chunk in processed_chunks}
    existing_documents = db.query(Document).filter(Document.source_file.in_(source_files)).all()
    existing_by_source = {doc.source_file: doc for doc in existing_documents}

    chunk_count = 0
    for source_file in source_files:
        file_chunks = [chunk for chunk in processed_chunks if chunk.source_file == source_file]
        first_chunk = file_chunks[0]

        document = existing_by_source.get(source_file)
        if document is None:
            document = Document(
                title=first_chunk.title,
                source_type=first_chunk.source_type,
                source_file=first_chunk.source_file,
                category=first_chunk.category,
            )
            db.add(document)
            db.flush()
        else:
            document.title = first_chunk.title
            document.source_type = first_chunk.source_type
            document.category = first_chunk.category
            db.query(DocumentChunkEmbedding).filter(
                DocumentChunkEmbedding.chunk_id.in_(
                    db.query(DocumentChunk.chunk_id).filter(DocumentChunk.document_id == document.document_id)
                )
            ).delete(synchronize_session=False)
            db.query(DocumentChunk).filter(DocumentChunk.document_id == document.document_id).delete()
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
    return {"document_count": len(source_files), "chunk_count": chunk_count}
