---
type: entity
sources:
  - C:\ConsultationApplication\src\routes\sessions.js
updated: 2026-04-26
tags: [routes, sessions, api]
---

# route-sessions

## 概要

セッションの作成・再開・クローズの Express ルータ。`createSessionsRouter(repo)`。`/api/sessions` 配下に3エンドポイント。

## エンドポイント

### `POST /api/sessions`

- 認証: [[user-identification]]（ヘッダ優先 + bodyフォールバック）
- body: `{ clientSessionId? }`
- 動作: `clientSessionId` が文字列ならそれを採用、なければ `randomUUID()` で発行 → `repo.createSession`（`INSERT OR IGNORE` で冪等）
- 成功: `201 { sessionId, startedAt }`

### `GET /api/sessions/resumable`

- 認証: ヘッダ または `?uuid=`。両方ある場合は **不一致で 403**（[[user-identification]] §クロスチェック）
- ユーザー存在チェック → 無ければ `404`
- `repo.getResumableSession` … 当日未close最新1件 + messages + emotions
- 該当なし: `204` を返す（空 body）
- 該当あり: `200 { session, messages, emotions }`

### `POST /api/sessions/:id/close`

- 認証: ヘッダ
- 冪等。`repo.closeSession` が `{ sessionId, closedAt, alreadyClosed }` を返す
- 所有者不一致 / セッション未存在: `404`

## 関連

- [[db-repo]] — `createSession` / `getResumableSession` / `closeSession`
- [[db-table-sessions]]
- [[session-lifecycle]] — 作成→resume→close と orphan close
- [[user-identification]] — 認証ヘッダ規約
- 呼び出し元: [[client-api]] `createSession` / `closeSession` / `getResumableSession`、[[client-main]]（送信時の冪等 create / リセット時の close）、[[ui-resume]]（fresh 時の close）、[[frontend-bootstrap]]（起動時の resumable 判定）

## 出典

- `C:\ConsultationApplication\src\routes\sessions.js:22-110`
