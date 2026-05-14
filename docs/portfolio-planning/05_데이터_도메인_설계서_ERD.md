# 데이터/도메인 설계서 (ERD 포함)

## 1. 핵심 엔티티
- `users`
- `chat_sessions`
- `messages`
- `answer_metas`
- `answer_traces`
- `user_notifications`
- `user_files`
- `user_checklist_items`

## 2. 관계 요약
- `users` 1:N `chat_sessions`
- `chat_sessions` 1:N `messages`
- `messages` 1:1 `answer_metas`
- `messages` 1:N `answer_traces`
- `users` 1:N `user_notifications`
- `users` 1:N `user_files`
- `users` 1:N `user_checklist_items`
- `chat_sessions` 1:N `user_notifications` (세션 ID 참조)
- `chat_sessions` 1:N `user_files` (세션 연결 필드)
- `chat_sessions` 1:N `user_checklist_items`

## 3. 핵심 필드
- 상담
  - `chat_session_id`, `title`, `category`, `risk_level`, `is_deleted`
- 알림
  - `source(manual/chat_auto)`, `alert_type(summary/document/...)`, `chat_session_id`
- 증거
  - `original_filename`, `mime_type`, `category`, `chat_session_id`, `is_deleted`
- 체크리스트
  - `chat_session_id`, `item_type(next_action/required_doc)`, `item_text`, `is_done`

## 4. ERD (텍스트)
```text
users
 ├─< chat_sessions
 │    └─< messages
 │         ├─ answer_metas
 │         └─< answer_traces
 ├─< user_notifications
 ├─< user_files
 └─< user_checklist_items
```

