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
            structured, applied_rule, _, text, action_items = chat_service._build_structured_answer(
                question="임금이 늦게 들어왔어요",
                category="임금/수당",
                chunks=_sample_chunks(),
                user_context={"company_size": "5인 이상"},
            )
        self.assertEqual(applied_rule, "근로기준법 제43조, 12쪽")
        self.assertTrue(structured.answer_sections)
        self.assertIn("사용자 맥락", text)
        self.assertIn("준비할 서류", text)
        self.assertIn("급여명세서", action_items["required_docs"])

    def test_context_signal_scoring_changes_with_context(self):
        chunk = _sample_chunks()[0][0]
        score_without = _score_context_signals(chunk, None)
        score_with = _score_context_signals(chunk, {"employment_status": "재직 중", "industry": "서비스업"})
        self.assertGreaterEqual(score_with, score_without)

    def test_extract_action_items_for_dismissal_question(self):
        structured = chat_service.StructuredAnswerResponse(
            summary="요약",
            answer="답변",
            answer_sections=[],
            guidance=["해고 관련 사실관계를 정리하세요."],
            caution="주의",
            cited_rules=[],
            primary_citation=None,
            sources=[],
        )
        items = chat_service._extract_action_items(
            category="고용보장/해고",
            question="해고예고수당을 못 받았어요.",
            structured_answer=structured,
        )
        self.assertIn("해고통지서 또는 안내문", items["required_docs"])

    def test_extract_action_items_for_wage_question(self):
        structured = chat_service.StructuredAnswerResponse(
            summary="요약",
            answer="답변",
            answer_sections=[],
            guidance=["임금 지급 내역을 정리하세요."],
            caution="주의",
            cited_rules=[],
            primary_citation=None,
            sources=[],
        )
        items = chat_service._extract_action_items(
            category="근로시간/휴가",
            question="월급이 늦게 들어왔어요. 체불인가요?",
            structured_answer=structured,
        )
        self.assertIn("급여명세서", items["required_docs"])
        self.assertIn("임금지급내역(통장입금내역)", items["required_docs"])

    def test_extract_action_items_for_leave_question(self):
        structured = chat_service.StructuredAnswerResponse(
            summary="요약",
            answer="답변",
            answer_sections=[],
            guidance=["연차 승인 여부를 확인하세요."],
            caution="주의",
            cited_rules=[],
            primary_citation=None,
            sources=[],
        )
        items = chat_service._extract_action_items(
            category="임금/수당",
            question="연차를 못 쓰게 하는데 어떻게 하죠?",
            structured_answer=structured,
        )
        self.assertIn("연차신청/승인기록", items["required_docs"])

    def test_follow_up_question_is_detected(self):
        self.assertTrue(chat_service._is_follow_up_question("그럼 이제 뭐부터 해야 돼요?"))
        self.assertTrue(chat_service._is_follow_up_question("필요한 서류는요?"))
        self.assertFalse(chat_service._is_follow_up_question("출산휴가 중 불이익을 받았습니다."))

    def test_search_query_uses_previous_context_for_follow_up(self):
        session = chat_service.ChatSession(category="일·가정 양립")
        session.messages = [
            chat_service.Message(message_index=1, role="user", content="출산휴가 쓰려는데 회사가 불이익을 줘요"),
            chat_service.Message(message_index=2, role="assistant", content="제74조를 보세요"),
        ]

        query = chat_service._build_search_query("그럼 필요한 서류는?", session)

        self.assertIn("일·가정 양립", query)
        self.assertIn("출산휴가 쓰려는데 회사가 불이익을 줘요", query)
        self.assertIn("그럼 필요한 서류는?", query)


if __name__ == "__main__":
    unittest.main()
