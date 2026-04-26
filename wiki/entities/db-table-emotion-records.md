---
type: entity
sources:
  - C:\ConsultationApplication\src\db\schema.js
  - C:\ConsultationApplication\src\db\repo.js
updated: 2026-04-26
tags: [db, schema, table, emotions]
---

# db-table-emotion-records

## 概要

絵文字による感情ラベル（1〜5の整数）の append-only テーブル。発言と必ずしも紐づく必要はない（`message_id` は NULL 許容）。

## カラム

| カラム | 型 | 制約 |
| --- | --- | --- |
| `id` | TEXT | PRIMARY KEY |
| `session_id` | TEXT NOT NULL | `REFERENCES sessions(id) ON DELETE CASCADE` |
| `message_id` | TEXT | `REFERENCES messages(id) ON DELETE SET NULL` |
| `emoji_value` | INTEGER NOT NULL | `BETWEEN 1 AND 5` |
| `created_at` | TEXT NOT NULL | UTC ISO8601 |

`message_id` の `ON DELETE SET NULL` により、発言が消えても感情記録は残る（履歴の一貫性より集計用途を優先）。

## インデックス

- `idx_emotion_session_created ON emotion_records(session_id, created_at)`

## 操作

- INSERT: [[route-emotions]] `POST /api/emotions` ([[db-repo]].`insertEmotion`、UUID 自動採番)
- SELECT: [[db-repo]].`stListEmotions.all(sessionId)` — `created_at ASC`、[[route-history]] と `getResumableSession` から呼ばれる

## 関連

- [[db-table-sessions]]
- [[db-table-messages]]
- [[route-emotions]] / [[route-history]]
- [[db-repo]]

## 出典

- `C:\ConsultationApplication\src\db\schema.js:35-41`
- index 定義: `:45`
