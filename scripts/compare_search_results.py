from __future__ import annotations

import argparse
import os
from pathlib import Path

from app.services.embedding_service import _fallback_embed, embed_text
from app.services.knowledge_base import (
    _extract_article_heading,
    _score_first_pass,
    _score_rerank,
    _tokenize,
    load_knowledge_base,
    search_knowledge,
)


DEFAULT_QUESTIONS = [
    "근로기준법 제43조가 뭐예요?",
    "임금이 늦게 들어왔는데 체불임금에 해당하나요?",
    "해고예고 없이 바로 해고할 수 있나요?",
    "육아휴직 급여는 언제부터 받을 수 있나요?",
    "연차휴가는 1년 미만 직원도 생기나요?",
]


def _safe_embed_text(text: str) -> tuple[str, list[float]]:
    try:
        return embed_text(text)
    except Exception:
        return _fallback_embed(text)


def _build_citation(chunk) -> str:
    if chunk.article_number and chunk.page_number:
        return f"{chunk.title} {chunk.article_number}, {chunk.page_number}쪽"
    if chunk.article_number:
        return f"{chunk.title} {chunk.article_number}"
    if chunk.page_number:
        return f"{chunk.title}, {chunk.page_number}쪽"
    return chunk.title


def _load_questions(path: str | None) -> list[str]:
    if not path:
        return DEFAULT_QUESTIONS

    question_path = Path(path)
    lines = question_path.read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip()]


def _rank_first_pass(question: str, top_n: int) -> list[tuple[object, float, float, float]]:
    question_tokens = _tokenize(question)
    _, query_vector = _safe_embed_text(question)
    scored: list[tuple[object, float, float, float]] = []

    for chunk in load_knowledge_base():
        first_pass_score, vector_score = _score_first_pass(question, question_tokens, query_vector, chunk)
        if first_pass_score <= 0:
            continue
        normalized_score = min(first_pass_score / max((len(question_tokens) * 2.5), 1), 1.0)
        scored.append((chunk, round(normalized_score, 2), first_pass_score, vector_score))

    scored.sort(key=lambda item: (item[2], item[1], item[3], item[0].chunk_id), reverse=True)

    selected: list[tuple[object, float, float, float]] = []
    seen_sources: set[tuple[str, str | None]] = set()
    for item in scored:
        chunk = item[0]
        source_key = (chunk.source_file, chunk.article_number)
        if source_key in seen_sources:
            continue
        selected.append(item)
        seen_sources.add(source_key)
        if len(selected) >= top_n:
            break
    return selected


def _rank_rerank(question: str, top_n: int) -> list[tuple[object, float, float, float, float]]:
    question_tokens = _tokenize(question)
    _, query_vector = _safe_embed_text(question)
    first_pass_scored: list[tuple[object, float, float]] = []

    for chunk in load_knowledge_base():
        first_pass_score, vector_score = _score_first_pass(question, question_tokens, query_vector, chunk)
        if first_pass_score <= 0:
            continue
        first_pass_scored.append((chunk, first_pass_score, vector_score))

    first_pass_scored.sort(key=lambda item: (item[1], item[2], item[0].chunk_id), reverse=True)
    rerank_pool_size = min(max(top_n * 4, 8), len(first_pass_scored))
    rerank_candidates = first_pass_scored[:rerank_pool_size]
    normalization_base = max((len(question_tokens) * 3.0), 1)

    rescored: list[tuple[object, float, float, float, float]] = []
    for chunk, first_pass_score, vector_score in rerank_candidates:
        rerank_score = _score_rerank(question, question_tokens, chunk)
        final_score = (first_pass_score * 0.55) + (rerank_score * 0.45)
        final_normalized_score = min(final_score / normalization_base, 1.0)
        rescored.append((chunk, round(final_normalized_score, 2), final_score, first_pass_score, rerank_score))

    rescored.sort(key=lambda item: (item[2], item[1], item[3], item[0].chunk_id), reverse=True)

    selected: list[tuple[object, float, float, float, float]] = []
    seen_sources: set[tuple[str, str | None]] = set()
    for item in rescored:
        chunk = item[0]
        source_key = (chunk.source_file, chunk.article_number)
        if source_key in seen_sources:
            continue
        selected.append(item)
        seen_sources.add(source_key)
        if len(selected) >= top_n:
            break
    return selected


def _print_first_pass(question: str, top_n: int) -> None:
    print("FIRST PASS")
    for rank, (chunk, normalized_score, first_pass_score, vector_score) in enumerate(
        _rank_first_pass(question, top_n),
        start=1,
    ):
        heading = _extract_article_heading(chunk) or "-"
        print(
            f"{rank}. score={normalized_score:.2f} first_pass={first_pass_score:.2f} "
            f"vector={vector_score:.2f} citation={_build_citation(chunk)}"
        )
        print(f"   source={chunk.source_file} heading={heading}")


def _print_rerank(question: str, top_n: int) -> None:
    print("RERANK FINAL")
    for rank, (chunk, normalized_score, final_score, first_pass_score, rerank_score) in enumerate(
        _rank_rerank(question, top_n),
        start=1,
    ):
        heading = _extract_article_heading(chunk) or "-"
        print(
            f"{rank}. score={normalized_score:.2f} final={final_score:.2f} "
            f"first_pass={first_pass_score:.2f} rerank={rerank_score:.2f} "
            f"citation={_build_citation(chunk)}"
        )
        print(f"   source={chunk.source_file} heading={heading}")


def _print_api_result(question: str, top_n: int) -> None:
    print("SEARCH_KNOWLEDGE RESULT")
    for rank, (chunk, score) in enumerate(search_knowledge(question, top_k=top_n), start=1):
        heading = _extract_article_heading(chunk) or "-"
        print(f"{rank}. score={score:.2f} citation={_build_citation(chunk)}")
        print(f"   source={chunk.source_file} heading={heading}")


def main() -> None:
    os.environ["OPENAI_API_KEY"] = ""
    parser = argparse.ArgumentParser(description="Compare first-pass and reranked legal search results.")
    parser.add_argument("--questions-file", type=str, default=None, help="UTF-8 text file with one question per line")
    parser.add_argument("--top-k", type=int, default=3, help="Number of results to print per stage")
    args = parser.parse_args()

    questions = _load_questions(args.questions_file)
    for index, question in enumerate(questions, start=1):
        print("=" * 80)
        print(f"QUESTION {index}: {question}")
        print("-" * 80)
        _print_first_pass(question, args.top_k)
        print("-" * 80)
        _print_rerank(question, args.top_k)
        print("-" * 80)
        _print_api_result(question, args.top_k)
        print()


if __name__ == "__main__":
    main()
