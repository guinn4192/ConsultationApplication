---
type: topic
sources:
  - C:\ConsultationApplication\src\db\schema.js
updated: 2026-04-26
tags: [db, schema, er]
---

# data-model

## 概要

[[db-schema]] が定義する 4 テーブルの関係を俯瞰する topic。詳細はそれぞれのテーブルページにあるので、ここでは ER 図と削除挙動・代表クエリだけまとめる。

## ER

```
users (uuid PK)
  │  1
  │
  │  N
sessions (id PK, user_uuid FK)         ◄── ON DELETE CASCADE from users
  │  1
  ├──────────────┐
  │  N           │ N
messages         emotion_records
  (id PK,        (id PK,
   session_id    session_id FK,
   FK)           message_id FK[NULL])  ◄── ON DELETE SET NULL from messages
                                       ◄── ON DELETE CASCADE from sessions
```

- ユーザー削除 → そのユーザーの全セッションが消え、連鎖して messages / emotion_records も消える。
- 発言（messages）削除 → 紐づく emotion_records は **残るが `message_id = NULL`** になる（感情ログは集計用途で残す設計）。

## 代表クエリ

| 用途 | テーブル | クエリ箇所 |
| --- | --- | --- |
| 履歴一覧 + 先頭発言プレビュー | sessions × messages | [[db-repo]] `stListSessions`（サブクエリで N+1 回避） |
| 当日 resume | sessions + messages + emotion_records | [[db-repo]] `getResumableSession` |
| セッション詳細 | sessions + messages + emotion_records | [[db-repo]] `getSessionDetail` |
| orphan close | sessions | [[db-schema]] / [[orphan-close]]（[[session-lifecycle]] 内） |

## インデックス戦略

- 全インデックスが **`(子テーブル.parent_fk, created_at)`** の形 → 履歴系クエリ（特定 session/user の時系列）が主要ワークロードであることを反映。
- カバリングではないので `SELECT *` は heap fetch を伴うが、本アプリのデータ量では問題視していない。

## タイムスタンプ規約

すべての `created_at` / `started_at` / `closed_at` は UTC ISO8601 (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`)。日付比較は `date(...)` で日付部分だけ取り出して比較する（[[session-lifecycle]] の resume / orphan close で使用）。

## 関連

- 各テーブル: [[db-table-users]] / [[db-table-sessions]] / [[db-table-messages]] / [[db-table-emotion-records]]
- 周辺: [[db-schema]] / [[db-repo]] / [[session-lifecycle]]

## 出典

- `C:\ConsultationApplication\src\db\schema.js:10-46`
