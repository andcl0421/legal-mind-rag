import os
from io import BytesIO
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
        token = self._signup_and_login(email="chat-session-user@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "content": "임금이 늦게 들어왔어요",
            "company_size": "5인 이상",
            "industry": "서비스업",
            "employment_type": "정규직",
            "employment_status": "재직 중",
        }
        create_resp = self.client.post("/api/v1/chat", json=payload, headers=headers)
        self.assertEqual(create_resp.status_code, 200)
        data = create_resp.json()
        self.assertIn("chat_session_id", data)
        session_id = data["chat_session_id"]

        sessions_resp = self.client.get("/api/v1/chat")
        self.assertEqual(sessions_resp.status_code, 200)
        sessions = sessions_resp.json()["sessions"]
        matching = next((item for item in sessions if item["chat_session_id"] == session_id), None)
        self.assertIsNotNone(matching)
        self.assertTrue(matching["latest_primary_citation"])
        self.assertTrue(matching["latest_source_label"])

        detail_resp = self.client.get(f"/api/v1/chat/{session_id}")
        self.assertEqual(detail_resp.status_code, 200)
        detail = detail_resp.json()
        self.assertEqual(detail["chat_session_id"], session_id)
        self.assertGreaterEqual(len(detail["messages"]), 2)
        self.assertTrue(detail["latest_sources"])
        self.assertTrue(detail["latest_sources"][0]["document_path"])
        self.assertTrue(detail["latest_answer_meta"])
        self.assertTrue(detail["latest_answer_traces"])
        self.assertTrue(detail["latest_primary_citation"])

        doc_resp = self.client.get(detail["latest_sources"][0]["document_path"])
        self.assertEqual(doc_resp.status_code, 200)
        self.assertEqual(doc_resp.headers["content-type"], "application/pdf")

        report_resp = self.client.get(f"/api/v1/chat/{session_id}/report.pdf", headers=headers)
        self.assertEqual(report_resp.status_code, 200)
        self.assertEqual(report_resp.headers["content-type"], "application/pdf")
        self.assertTrue(report_resp.content.startswith(b"%PDF"))

        history_resp = self.client.get(f"/api/v1/chat/{session_id}/messages")
        self.assertEqual(history_resp.status_code, 200)
        history = history_resp.json()
        self.assertEqual(history["chat_session_id"], session_id)
        self.assertGreaterEqual(len(history["messages"]), 2)

    def test_chat_detail_invalid_id_returns_404(self):
        resp = self.client.get("/api/v1/chat/not-a-valid-uuid")
        self.assertEqual(resp.status_code, 404)

    @patch("app.services.chat_service._generate_llm_answer_payload", return_value=None)
    def test_delete_chat_session_hides_it_from_list(self, _mock_llm):
        token = self._signup_and_login(email="chat-delete-user@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        create_resp = self.client.post(
            "/api/v1/chat",
            json={
                "content": "출산휴가를 쓰려는데 회사 대응이 궁금합니다.",
                "company_size": "5인 이상",
                "industry": "서비스업",
                "employment_type": "정규직",
                "employment_status": "재직 중",
            },
            headers=headers,
        )
        self.assertEqual(create_resp.status_code, 200)
        session_id = create_resp.json()["chat_session_id"]

        delete_resp = self.client.delete(f"/api/v1/chat/{session_id}", headers=headers)
        self.assertEqual(delete_resp.status_code, 200)
        self.assertEqual(delete_resp.json()["status"], "deleted")

        list_resp = self.client.get("/api/v1/chat")
        self.assertEqual(list_resp.status_code, 200)
        sessions = list_resp.json()["sessions"]
        self.assertFalse(any(item["chat_session_id"] == session_id for item in sessions))

        detail_resp = self.client.get(f"/api/v1/chat/{session_id}")
        self.assertEqual(detail_resp.status_code, 404)

    def _signup_and_login(self, email: str = "worker@example.com", password: str = "password123") -> str:
        signup_payload = {
            "email": email,
            "password": password,
            "nickname": "worker",
            "emp_count_type": "OVER_5",
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

    def _signup_login_with_user(self, email: str, password: str = "password123") -> tuple[str, dict]:
        signup_payload = {
            "email": email,
            "password": password,
            "nickname": "worker",
            "emp_count_type": "OVER_5",
        }
        signup_resp = self.client.post("/api/v1/auth/signup", json=signup_payload)
        if signup_resp.status_code not in (200, 201):
            self.fail(f"signup failed: {signup_resp.status_code} {signup_resp.text}")
        login_resp = self.client.post("/api/v1/auth/login", json={"email": email, "password": password})
        self.assertEqual(login_resp.status_code, 200)
        body = login_resp.json()
        return body["token"]["access_token"], body["user"]

    def test_auth_signup_login_and_me(self):
        token = self._signup_and_login()
        self.assertTrue(token)

        me_resp = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_resp.status_code, 200)
        me_data = me_resp.json()
        self.assertEqual(me_data["email"], "worker@example.com")

        update_resp = self.client.patch(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"nickname": "updated-worker", "emp_count_type": "OVER_30", "region_code": "BUSAN"},
        )
        self.assertEqual(update_resp.status_code, 200)
        updated = update_resp.json()
        self.assertEqual(updated["nickname"], "updated-worker")
        self.assertEqual(updated["emp_count_type"], "OVER_30")
        self.assertEqual(updated["region_code"], "BUSAN")

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

    def test_evidence_upload_list_download_delete(self):
        token = self._signup_and_login(email="evidence-user@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        chat_resp = self.client.post(
            "/api/v1/chat",
            json={
                "content": "임금체불 상담 테스트",
                "company_size": "5인 이상",
                "industry": "서비스업",
                "employment_type": "정규직",
                "employment_status": "재직 중",
            },
            headers=headers,
        )
        self.assertEqual(chat_resp.status_code, 200)
        session_id = chat_resp.json()["chat_session_id"]

        upload_resp = self.client.post(
            "/api/v1/evidence",
            headers=headers,
            files={"file": ("salary-slip.txt", b"salary evidence content", "text/plain")},
            data={"description": "급여명세 증거", "category": "급여명세서", "chat_session_id": session_id},
        )
        self.assertEqual(upload_resp.status_code, 201)
        uploaded = upload_resp.json()
        file_id = uploaded["user_file_id"]
        self.assertEqual(uploaded["category"], "급여명세서")
        self.assertEqual(uploaded["chat_session_id"], session_id)

        list_resp = self.client.get("/api/v1/evidence", headers=headers)
        self.assertEqual(list_resp.status_code, 200)
        items = list_resp.json()["items"]
        self.assertTrue(any(item["user_file_id"] == file_id for item in items))

        filter_by_category_resp = self.client.get("/api/v1/evidence?category=급여명세서", headers=headers)
        self.assertEqual(filter_by_category_resp.status_code, 200)
        category_items = filter_by_category_resp.json()["items"]
        self.assertTrue(any(item["user_file_id"] == file_id for item in category_items))

        filter_by_session_resp = self.client.get(f"/api/v1/evidence?chat_session_id={session_id}", headers=headers)
        self.assertEqual(filter_by_session_resp.status_code, 200)
        session_items = filter_by_session_resp.json()["items"]
        self.assertTrue(any(item["user_file_id"] == file_id for item in session_items))

        chat_with_evidence_resp = self.client.post(
            "/api/v1/chat",
            headers=headers,
            json={
                "content": "이 증거 기준으로 다음 대응 알려줘",
                "chat_session_id": session_id,
                "company_size": "5인 이상",
                "industry": "서비스업",
                "employment_type": "정규직",
                "employment_status": "재직 중",
                "evidence_file_ids": [file_id],
            },
        )
        self.assertEqual(chat_with_evidence_resp.status_code, 200)
        self.assertIn("검토한 첨부 증거", chat_with_evidence_resp.json()["latest_assistant_message"]["content"])

        download_resp = self.client.get(f"/api/v1/evidence/{file_id}/download", headers=headers)
        self.assertEqual(download_resp.status_code, 200)
        self.assertEqual(download_resp.content, b"salary evidence content")

        delete_resp = self.client.delete(f"/api/v1/evidence/{file_id}", headers=headers)
        self.assertEqual(delete_resp.status_code, 204)

        list_after = self.client.get("/api/v1/evidence", headers=headers)
        self.assertEqual(list_after.status_code, 200)
        items_after = list_after.json()["items"]
        self.assertFalse(any(item["user_file_id"] == file_id for item in items_after))

    def test_auth_duplicate_signup_returns_409(self):
        payload = {
            "email": "dup-user@example.com",
            "password": "password123",
            "nickname": "dup",
            "emp_count_type": "OVER_5",
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

    def test_auth_signup_invalid_emp_count_type_returns_400(self):
        resp = self.client.post(
            "/api/v1/auth/signup",
            json={
                "email": "invalid-emp@example.com",
                "password": "password123",
                "nickname": "bad",
                "emp_count_type": "INVALID",
            },
        )
        self.assertEqual(resp.status_code, 400)

    @patch("app.services.chat_service._generate_llm_answer_payload", return_value=None)
    def test_chat_creates_auto_alerts_for_user(self, _mock_llm):
        token, user = self._signup_login_with_user("chat-auto-alert@example.com")
        payload = {
            "content": "해고예고수당이 필요한지 궁금합니다.",
            "user_id": user["user_id"],
            "company_size": "5인 이상",
            "industry": "서비스업",
            "employment_type": "정규직",
            "employment_status": "재직 중",
        }
        chat_resp = self.client.post("/api/v1/chat", json=payload, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(chat_resp.status_code, 200)
        session_id = chat_resp.json()["chat_session_id"]

        list_resp = self.client.get("/api/v1/alerts", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(list_resp.status_code, 200)
        items = list_resp.json()["items"]
        auto_items = [item for item in items if item.get("source") == "chat_auto"]
        self.assertGreaterEqual(len(auto_items), 2)
        self.assertTrue(any(item.get("chat_session_id") == session_id for item in auto_items))

        filtered_resp = self.client.get(
            f"/api/v1/alerts?source=chat_auto&chat_session_id={session_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(filtered_resp.status_code, 200)
        filtered_items = filtered_resp.json()["items"]
        self.assertTrue(filtered_items)
        self.assertTrue(all(item.get("chat_session_id") == session_id for item in filtered_items))

    def test_chat_create_requires_auth(self):
        payload = {
            "content": "연차 사용 가능 여부가 궁금합니다.",
            "company_size": "5인 이상",
            "industry": "서비스업",
            "employment_type": "정규직",
            "employment_status": "재직 중",
        }
        resp = self.client.post("/api/v1/chat", json=payload)
        self.assertEqual(resp.status_code, 401)

    def test_checklist_save_and_list(self):
        token = self._signup_and_login(email="checklist-user@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        session_id = "11111111-2222-3333-4444-555555555555"

        save_resp = self.client.post(
            "/api/v1/checklist",
            headers=headers,
            json={
                "chat_session_id": session_id,
                "item_type": "required_doc",
                "item_text": "근로계약서",
                "is_done": True,
            },
        )
        self.assertEqual(save_resp.status_code, 200)
        self.assertTrue(save_resp.json()["is_done"])

        list_resp = self.client.get(f"/api/v1/checklist?chat_session_id={session_id}", headers=headers)
        self.assertEqual(list_resp.status_code, 200)
        items = list_resp.json()["items"]
        self.assertTrue(any(item["item_text"] == "근로계약서" and item["is_done"] for item in items))


if __name__ == "__main__":
    unittest.main()
