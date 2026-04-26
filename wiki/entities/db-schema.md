---
type: entity
sources:
  - C:\ConsultationApplication\src\db\schema.js
updated: 2026-04-26
tags: [db, schema, sqlite, ddl]
---

# db-schema

## 概要

DB 初期化スクリプト。`initSchema(db)` を公開する。テーブル/インデックスのDDL適用、PRAGMA 設定、起動時の **orphan close** を一括で行う。

## 手順

1. **PRAGMA 設定**（個別 try/catch、失敗は致命でない）
   - `journal_mode = WAL`
   - `foreign_keys = ON`
   - `synchronous = NORMAL`
2. **テーブル/インデックス作成**（`CREATE ... IF NOT EXISTS`）
   - 4 テーブル: [[db-table-users]] / [[db-table-sessions]] / [[db-table-messages]] / [[db-table-emotion-records]]
   - 3 インデックス:
     - `idx_sessions_user_started ON sessions(user_uuid, started_at DESC)`
     - `idx_messages_session_created ON messages(session_id, created_at)`
     - `idx_emotion_session_created ON emotion_records(session_id, created_at)`
3. **Orphan close**: `closed_at IS NULL AND date(started_at) < date('now')` を `UPDATE` で一括 close。`{ orphanClosed: <件数> }` を返す。

詳細は [[orphan-close]]（[[session-lifecycle]] 内に節として記述）参照。

## 整合性ルール（CHECK / FK）

- `users.user_name` … `length BETWEEN 1 AND 50`
- `messages.role` … `IN ('user','assistant')`
- `emotion_records.emoji_value` … `BETWEEN 1 AND 5`
- FK
  - `sessions.user_uuid → users.uuid` `ON DELETE CASCADE`
  - `messages.session_id → sessions.id` `ON DELETE CASCADE`
  - `emotion_records.session_id → sessions.id` `ON DELETE CASCADE`
  - `emotion_records.message_id → messages.id` `ON DELETE SET NULL`

タイムスタンプはすべて `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`（UTC ISO8601）で生成される。

## 関連

- [[db-driver]] — 本スクリプトが使う `db.exec` / `db.pragma` / `db.prepare` の提供元
- [[data-store]] — DDL が適用される物理ファイル（WAL モードもここで意味を持つ）
- [[data-model]] — 4テーブルの関係を俯瞰する topic
- [[session-lifecycle]] — orphan close の意味
- 各テーブル: [[db-table-users]] / [[db-table-sessions]] / [[db-table-messages]] / [[db-table-emotion-records]]

## 出典

- `C:\ConsultationApplication\src\db\schema.js:10-82`
- DESIGN.md §5.2 / §5.3 / §5.4 / §7.7（参照）
