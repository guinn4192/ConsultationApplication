---
type: entity
sources:
  - C:\ConsultationApplication\src\db\schema.js
  - C:\ConsultationApplication\src\db\repo.js
updated: 2026-04-26
tags: [db, schema, table, sessions]
---

# db-table-sessions

## 概要

相談セッションのテーブル。`closed_at IS NULL` が「進行中」を意味する。ライフサイクルは [[session-lifecycle]] 参照。

## カラム

| カラム | 型 | 制約 |
| --- | --- | --- |
| `id` | TEXT | PRIMARY KEY |
| `user_uuid` | TEXT NOT NULL | `REFERENCES users(uuid) ON DELETE CASCADE` |
| `started_at` | TEXT NOT NULL | UTC ISO8601 |
| `closed_at` | TEXT | NULL = 進行中 |

## インデックス

- `idx_sessions_user_started ON sessions(user_uuid, started_at DESC)` — 履歴/再開クエリの基盤

## 操作

- INSERT (`OR IGNORE`): [[route-sessions]] `POST /api/sessions`（[[db-repo]].`createSession`）
- UPDATE close: [[route-sessions]] `POST /api/sessions/:id/close`（[[db-repo]].`closeSession`、所有者一致 + `closed_at IS NULL` 条件）
- SELECT (resume): [[db-repo]].`getResumableSession` — 当日未close最新1件
- SELECT (履歴): [[db-repo]].`listSessionsByUser` — `started_at DESC` で全件
- 起動時 orphan close: [[db-schema]] / [[orphan-close]]

## 関連

- [[db-table-users]]
- [[db-table-messages]] — `messages.session_id → sessions.id`
- [[db-table-emotion-records]] — `emotion_records.session_id → sessions.id`
- [[route-sessions]] / [[route-history]]
- [[session-lifecycle]]

## 出典

- `C:\ConsultationApplication\src\db\schema.js:18-23`
- index 定義: `:43`
