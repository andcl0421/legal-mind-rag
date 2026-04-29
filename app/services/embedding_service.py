from __future__ import annotations

import json
import math
import os
import re
from collections import Counter

from openai import OpenAI


EMBEDDING_MODEL_NAME = "text-embedding-3-small"
FALLBACK_MODEL_NAME = "local-hash-128"
FALLBACK_DIMENSION = 128


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[0-9A-Za-z가-힣]+", text.lower())


def _normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def _fallback_embed(text: str, dimension: int = FALLBACK_DIMENSION) -> tuple[str, list[float]]:
    counts = Counter(_tokenize(text))
    vector = [0.0] * dimension
    for token, count in counts.items():
        vector[hash(token) % dimension] += float(count)
    return FALLBACK_MODEL_NAME, _normalize(vector)


def _openai_embed(text: str) -> tuple[str, list[float]]:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.embeddings.create(model=EMBEDDING_MODEL_NAME, input=text)
    vector = list(response.data[0].embedding)
    return EMBEDDING_MODEL_NAME, _normalize(vector)


def embed_text(text: str) -> tuple[str, list[float]]:
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        return _openai_embed(text)
    return _fallback_embed(text)


def cosine_similarity(vector_a: list[float], vector_b: list[float]) -> float:
    if not vector_a or not vector_b or len(vector_a) != len(vector_b):
        return 0.0
    return sum(a * b for a, b in zip(vector_a, vector_b))


def dumps_vector(vector: list[float]) -> str:
    return json.dumps(vector, ensure_ascii=False)


def loads_vector(raw: str) -> list[float]:
    return list(json.loads(raw))
