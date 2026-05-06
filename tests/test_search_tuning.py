import unittest

from app.services.knowledge_base import (
    KnowledgeChunk,
    _score_context_signals,
    _score_strict_intent_alignment,
)


class SearchTuningTests(unittest.TestCase):
    def test_strict_intent_alignment_prefers_matching_article(self):
        q = "해고예고 없이 바로 해고할 수 있나요?"
        correct = KnowledgeChunk(
            chunk_id=1,
            category="고용보장/해고",
            title="근로기준법",
            rule_label="근로기준법",
            content="제26조(해고의 예고) 사용자는 근로자를 해고하려면...",
            source_file="law.pdf",
            source_type="raw",
            article_number="제26조",
        )
        wrong = KnowledgeChunk(
            chunk_id=2,
            category="고용보장/해고",
            title="근로기준법",
            rule_label="근로기준법",
            content="제43조(임금 지급) 임금은 통화로 직접...",
            source_file="law.pdf",
            source_type="raw",
            article_number="제43조",
        )
        self.assertGreater(
            _score_strict_intent_alignment(q, correct),
            _score_strict_intent_alignment(q, wrong),
        )

    def test_strict_intent_alignment_for_delay_interest(self):
        q = "지연이자는 언제부터 붙나요?"
        correct = KnowledgeChunk(
            chunk_id=3,
            category="임금/수당",
            title="근로기준법",
            rule_label="근로기준법",
            content="제37조(미지급 임금에 대한 지연이자)",
            source_file="law.pdf",
            source_type="raw",
            article_number="제37조",
        )
        wrong = KnowledgeChunk(
            chunk_id=4,
            category="임금/수당",
            title="근로기준법",
            rule_label="근로기준법",
            content="제60조(연차 유급휴가)",
            source_file="law.pdf",
            source_type="raw",
            article_number="제60조",
        )
        self.assertGreater(
            _score_strict_intent_alignment(q, correct),
            _score_strict_intent_alignment(q, wrong),
        )

    def test_context_signal_prefers_matching_category(self):
        chunk_family = KnowledgeChunk(
            chunk_id=5,
            category="일·가정 양립",
            title="육아휴직과 급여",
            rule_label="육아휴직 및 급여 기본 구조",
            content="육아휴직은 자녀 연령, 고용보험 요건...",
            source_file="seed",
            source_type="seed",
        )
        chunk_wage = KnowledgeChunk(
            chunk_id=6,
            category="임금/수당",
            title="주휴수당 기본 요건",
            rule_label="주휴수당 기본 요건",
            content="주휴수당은...",
            source_file="seed",
            source_type="seed",
        )
        context = {"employment_status": "재직 중", "industry": "서비스업", "topic": "육아휴직"}
        self.assertGreater(_score_context_signals(chunk_family, context), _score_context_signals(chunk_wage, context))


if __name__ == "__main__":
    unittest.main()
