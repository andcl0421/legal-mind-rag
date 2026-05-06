import os
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.v1.api import api_router
from app.database.session import Base, get_db
import app.models  # noqa: F401
from app.services.knowledge_base import refresh_knowledge_base_cache


class ChatApiIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._db_path = os.path.abspath(os.path.join("tests", "_integration_test.db"))
        if os.path.exists(cls._db_path):
            os.remove(cls._db_path)
        cls._engine = create_engine(f"sqlite:///{cls._db_path}", connect_args={"check_same_thread": False})
        cls._TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls._engine)
        Base.metadata.create_all(bind=cls._engine)

        app = FastAPI()
        app.include_router(api_router, prefix="/api/v1")

        def override_get_db():
            db = cls._TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)
        refresh_knowledge_base_cache()

    @classmethod
    def tearDownClass(cls):
        cls._engine.dispose()
        if os.path.exists(cls._db_path):
            os.remove(cls._db_path)

    @patch("app.services.chat_service._generate_llm_answer_payload", return_value=None)
    def test_create_and_fetch_chat_session(self, _mock_llm):
        payload = {
            "content": "임금이 늦게 들어왔어요",
            "company_size": "5인 이상",
            "industry": "서비스업",
            "employment_type": "정규직",
            "employment_status": "재직 중",
        }
        create_resp = self.client.post("/api/v1/chat", json=payload)
        self.assertEqual(create_resp.status_code, 200)
        data = create_resp.json()
        self.assertIn("chat_session_id", data)
        session_id = data["chat_session_id"]

        sessions_resp = self.client.get("/api/v1/chat")
        self.assertEqual(sessions_resp.status_code, 200)
        sessions = sessions_resp.json()["sessions"]
        self.assertTrue(any(item["chat_session_id"] == session_id for item in sessions))

        detail_resp = self.client.get(f"/api/v1/chat/{session_id}")
        self.assertEqual(detail_resp.status_code, 200)
        detail = detail_resp.json()
        self.assertEqual(detail["chat_session_id"], session_id)
        self.assertGreaterEqual(len(detail["messages"]), 2)

        history_resp = self.client.get(f"/api/v1/chat/{session_id}/messages")
        self.assertEqual(history_resp.status_code, 200)
        history = history_resp.json()
        self.assertEqual(history["chat_session_id"], session_id)
        self.assertGreaterEqual(len(history["messages"]), 2)

    def test_chat_detail_invalid_id_returns_404(self):
        resp = self.client.get("/api/v1/chat/not-a-valid-uuid")
        self.assertEqual(resp.status_code, 404)

    def _signup_and_login(self, email: str = "worker@example.com", password: str = "password123") -> str:
        signup_payload = {
            "email": email,
            "password": password,
            "nickname": "worker",
        }
        signup_resp = self.client.post("/api/v1/auth/signup", json=signup_payload)
        if signup_resp.status_code not in (200, 201):
            self.fail(f"signup failed: {signup_resp.status_code} {signup_resp.text}")

        login_resp = self.client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        self.assertEqual(login_resp.status_code, 200)
        return login_resp.json()["token"]["access_token"]

    def test_auth_signup_login_and_me(self):
        token = self._signup_and_login()
        self.assertTrue(token)

        me_resp = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_resp.status_code, 200)
        me_data = me_resp.json()
        self.assertEqual(me_data["email"], "worker@example.com")

    def test_alerts_create_list_and_mark_read(self):
        token = self._signup_and_login(email="alerts-user@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        create_resp = self.client.post(
            "/api/v1/alerts",
            headers=headers,
            json={"title": "테스트 알림", "content": "알림 내용입니다."},
        )
        self.assertEqual(create_resp.status_code, 201)
        alert = create_resp.json()
        self.assertFalse(alert["is_read"])
        alert_id = alert["user_notif_id"]

        list_resp = self.client.get("/api/v1/alerts", headers=headers)
        self.assertEqual(list_resp.status_code, 200)
        items = list_resp.json()["items"]
        self.assertTrue(any(item["user_notif_id"] == alert_id for item in items))

        read_resp = self.client.patch(f"/api/v1/alerts/{alert_id}/read", headers=headers)
        self.assertEqual(read_resp.status_code, 200)
        self.assertTrue(read_resp.json()["is_read"])

        unread_resp = self.client.get("/api/v1/alerts?unread_only=true", headers=headers)
        self.assertEqual(unread_resp.status_code, 200)
        unread_items = unread_resp.json()["items"]
        self.assertFalse(any(item["user_notif_id"] == alert_id for item in unread_items))

    def test_auth_duplicate_signup_returns_409(self):
        payload = {
            "email": "dup-user@example.com",
            "password": "password123",
            "nickname": "dup",
        }
        first = self.client.post("/api/v1/auth/signup", json=payload)
        self.assertEqual(first.status_code, 201)

        second = self.client.post("/api/v1/auth/signup", json=payload)
        self.assertEqual(second.status_code, 409)

    def test_auth_login_wrong_password_returns_401(self):
        self._signup_and_login(email="wrong-pass@example.com", password="password123")
        resp = self.client.post(
            "/api/v1/auth/login",
            json={"email": "wrong-pass@example.com", "password": "password999"},
        )
        self.assertEqual(resp.status_code, 401)

    def test_me_requires_valid_token(self):
        missing = self.client.get("/api/v1/auth/me")
        self.assertEqual(missing.status_code, 401)

        invalid = self.client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.value"})
        self.assertEqual(invalid.status_code, 401)

    def test_alerts_user_isolation_and_auth_errors(self):
        token_a = self._signup_and_login(email="alerts-a@example.com")
        token_b = self._signup_and_login(email="alerts-b@example.com")
        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        create_resp = self.client.post(
            "/api/v1/alerts",
            headers=headers_a,
            json={"title": "A 사용자 알림", "content": "A content"},
        )
        self.assertEqual(create_resp.status_code, 201)
        alert_id = create_resp.json()["user_notif_id"]

        # B 사용자는 A의 알림을 읽음 처리할 수 없어야 함
        forbidden_read = self.client.patch(f"/api/v1/alerts/{alert_id}/read", headers=headers_b)
        self.assertEqual(forbidden_read.status_code, 404)

        # 인증 없이 알림 API 접근 차단
        no_auth_create = self.client.post("/api/v1/alerts", json={"title": "x", "content": "y"})
        self.assertEqual(no_auth_create.status_code, 401)

        invalid_auth_list = self.client.get("/api/v1/alerts", headers={"Authorization": "Bearer bad.token"})
        self.assertEqual(invalid_auth_list.status_code, 401)


if __name__ == "__main__":
    unittest.main()
