---
type: entity
sources:
  - C:\ConsultationApplication\src\db\schema.js
  - C:\ConsultationApplication\src\db\repo.js
updated: 2026-04-26
tags: [db, schema, table, messages]
---

# db-table-messages

## 概要

セッション内の発言を1行=1発言で保持するテーブル。`role IN ('user','assistant')` の二値で発言主を分ける。

## カラム

| カラム | 型 | 制約 |
| --- | --- | --- |
| `id` | TEXT | PRIMARY KEY |
| `session_id` | TEXT NOT NULL | `REFERENCES sessions(id) ON DELETE CASCADE` |
| `role` | TEXT NOT NULL | `IN ('user','assistant')` |
| `content` | TEXT NOT NULL |  |
| `mode` | TEXT |  |
| `category` | TEXT |  |
| `created_at` | TEXT NOT NULL | UTC ISO8601 |

`mode` / `category` の値域はDB側では制約していない（アプリ層で正規化）。

## インデックス

- `idx_messages_session_created ON messages(session_id, created_at)` — セッション内の発言を時系列で並べる主クエリの基盤

## 操作

- INSERT: [[db-repo]].`insertMessage` … `mode` / `category` は `null` 許容で `String()` 変換
- SELECT: [[db-repo]].`stListMessages.all(sessionId)` — `created_at ASC`

`src/routes/` 配下には messages 専用のエンドポイントは無い（取得は [[route-history]] 経由、書き込みは src/ には未収録の SSE/チャットルートが担当する想定）。

## 関連

- [[db-table-sessions]]
- [[db-table-emotion-records]] — `emotion_records.message_id → messages.id`（`ON DELETE SET NULL`）
- [[route-history]] — 取得経路
- [[db-repo]]

## 出典

- `C:\ConsultationApplication\src\db\schema.js:25-33`
- index 定義: `:44`
