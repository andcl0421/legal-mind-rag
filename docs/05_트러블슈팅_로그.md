# 🛠️ 트러블슈팅 로그 (Troubleshooting Log)

프로젝트 개발 중 발생한 문제와 해결 과정을 기록합니다.

---

## 📝 [2026-03-10] 가상환경 및 서버 구동 이슈
- **문제**: `uvicorn` 실행 시 `ModuleNotFoundError` 발생.
- **원인**: 가상환경(`venv`)이 활성화되지 않은 상태에서 패키지를 호출함.
- **해결**: `.\venv\Scripts\activate` 명령어로 가상환경 진입 후 정상 작동 확인.

---

