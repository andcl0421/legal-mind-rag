import unittest
from unittest.mock import patch

from app.services import chat_service
from app.services.knowledge_base import KnowledgeChunk, _score_context_signals


def _sample_chunks() -> list[tuple[KnowledgeChunk, float]]:
    return [
        (
            KnowledgeChunk(
                chunk_id=11,
                category="임금/수당",
                title="근로기준법",
                rule_label="근로기준법",
                content="제43조(임금 지급) 임금은 통화로 직접 근로자에게 그 전액을 지급하여야 한다.",
                source_file="sample.pdf",
                source_type="raw",
                article_number="제43조",
                page_number=12,
            ),
            0.91,
        ),
    ]


class ChatServiceUnitTests(unittest.TestCase):
    def test_extract_json_payload_from_fenced_block(self):
        raw = """```json
{"summary":"ok","answer_sections":[],"guidance":[],"caution":"주의"}
```"""
        parsed = chat_service._extract_json_payload(raw)
        self.assertIsInstance(parsed, dict)
        self.assertEqual(parsed["summary"], "ok")

    def test_sanitize_llm_payload_blocks_unknown_citation(self):
        payload = {
            "summary": "요약",
            "answer_sections": [
                {"heading": "핵심 기준", "body": "내용", "citation": "허용되지 않은 근거"}
            ],
            "guidance": ["a"],
            "caution": "b",
        }
        sanitized = chat_service._sanitize_llm_payload(payload, {"근로기준법 제43조"})
        self.assertIsNotNone(sanitized)
        section = sanitized["answer_sections"][0]
        self.assertEqual(section["citation"], "")

    def test_build_structured_answer_falls_back_when_payload_invalid(self):
        with patch("app.services.chat_service._generate_llm_answer_payload", return_value=None):
            structured, applied_rule, _, text = chat_service._build_structured_answer(
                question="임금이 늦게 들어왔어요",
                category="임금/수당",
                chunks=_sample_chunks(),
                user_context={"company_size": "5인 이상"},
            )
        self.assertEqual(applied_rule, "근로기준법 제43조, 12쪽")
        self.assertTrue(structured.answer_sections)
        self.assertIn("사용자 맥락", text)

    def test_context_signal_scoring_changes_with_context(self):
        chunk = _sample_chunks()[0][0]
        score_without = _score_context_signals(chunk, None)
        score_with = _score_context_signals(chunk, {"employment_status": "재직 중", "industry": "서비스업"})
        self.assertGreaterEqual(score_with, score_without)


if __name__ == "__main__":
    unittest.main()
