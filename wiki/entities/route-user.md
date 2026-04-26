---
type: entity
sources:
  - C:\ConsultationApplication\src\routes\user.js
updated: 2026-04-26
tags: [routes, user, api]
---

# route-user

## 概要

ユーザー登録と取得の Express ルータ。`createUserRouter(repo)` で作成。`/api/user` 配下に2エンドポイント。

## エンドポイント

### `POST /api/user/register`

- body: `{ userName }`
- バリデーション
  - `typeof userName === "string"` を `trim()` 後に空でないこと
  - `length <= 50`（[[db-table-users]] の CHECK と整合）
- 成功: `201 { uuid, userName }`（UUID は `repo.createUser` 内で `randomUUID()`）
- 失敗: `400`（バリデーション）/ `500`（例外）

### `GET /api/user/:uuid`

- パス: `:uuid`
- `400` if uuid 不正、`404` if 未登録
- 成功時 **`repo.touchUser` で `last_active_at` を更新**（失敗しても致命扱いしない）
- レスポンス: `{ uuid, userName, lastActiveAt }`

## 認証

このルータには [[user-identification]] の `x-user-uuid` ヘッダは **使っていない**（登録自体が UUID 発行であり、取得は :uuid をパスで受ける）。他ルータとの非対称性に注意。

## 関連

- [[db-repo]] — `createUser` / `getUser` / `touchUser`
- [[db-table-users]]
- [[user-identification]]（他ルータの認可規約 — 本ルータは適用外）
- 呼び出し元: [[client-api]] `registerUser` / `getUser`、[[ui-onboarding]]、[[frontend-bootstrap]]（起動時の `getUser` 確認）

## 出典

- `C:\ConsultationApplication\src\routes\user.js:12-66`
- DESIGN.md §4.1 / §6 / §7.2（参照）
