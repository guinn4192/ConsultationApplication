---
type: entity
sources:
  - C:\ConsultationApplication\src\db\schema.js
  - C:\ConsultationApplication\src\db\repo.js
updated: 2026-04-26
tags: [db, schema, table]
---

# db-table-users

## 概要

ユーザー本体テーブル。本アプリの認証は **UUID所持＝本人** モデル（[[user-identification]] 参照）なので、行はパスワードを持たず識別子と表示名のみ。

## カラム

| カラム | 型 | 制約 |
| --- | --- | --- |
| `uuid` | TEXT | PRIMARY KEY |
| `user_name` | TEXT NOT NULL | `length BETWEEN 1 AND 50` |
| `created_at` | TEXT NOT NULL | DEFAULT `strftime('%Y-%m-%dT%H:%M:%fZ','now')` |
| `last_active_at` | TEXT NOT NULL | 同上 |

タイムスタンプは UTC ISO8601。

## 操作

- INSERT: [[route-user]] `POST /api/user/register` 経由 ([[db-repo]].`createUser`)
- SELECT: [[route-user]] `GET /api/user/:uuid` ([[db-repo]].`getUser`)
- UPDATE: [[db-repo]].`touchUser` … `GET /api/user/:uuid` 成功時に `last_active_at` 更新（失敗無視）

## 関連

- [[db-table-sessions]] — `sessions.user_uuid → users.uuid`（`ON DELETE CASCADE`）
- [[route-user]]
- [[user-identification]]

## 出典

- `C:\ConsultationApplication\src\db\schema.js:11-16`
