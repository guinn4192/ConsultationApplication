---
type: entity
sources:
  - C:\ConsultationApplication\src\db\repo.js
updated: 2026-04-26
tags: [db, repo, sqlite, security]
---

# db-repo

## 概要

`createRepo(db)` ファクトリで返される **ドメイン CRUD レイヤ**。すべて同期 API、すべて **prepared statement** を起動時に1度だけ作成・再利用する（SQLインジェクション防止 + 性能）。各ルータはこのオブジェクト経由でのみ DB に触れる。

## 公開メソッド

### users
- `createUser(userName)` → `{ uuid, userName }`（UUID自動採番）
- `getUser(uuid)` → 行 or `null`
- `touchUser(uuid)` … `last_active_at` 更新（失敗は無視）

### sessions
- `createSession(sessionId, userUuid)` … `INSERT OR IGNORE` で冪等。`{ sessionId, startedAt }` を返す
- `getSession(sessionId)` → 行 or `null`
- `closeSession(sessionId, userUuid)` … 冪等。`{ sessionId, closedAt, alreadyClosed }`。所有者不一致は `null`
- `getResumableSession(userUuid)` … 当日未close、`started_at DESC LIMIT 1`。messages/emotions 同梱で返す（[[session-lifecycle]] §resume）

### messages
- `insertMessage({ id, sessionId, role, content, mode, category })`

### emotions
- `insertEmotion({ sessionId, messageId, emojiValue })` … UUID自動採番、`message_id` は `null` 可

### history
- `listSessionsByUser(userUuid)` … 全セッション + 先頭 user 発言プレビュー（サブクエリ）
- `getSessionDetail(sessionId, userUuid)` … 所有者照合付き、messages/emotions 同梱。所有者不一致は `{ forbidden: true }`

## 設計上の注意

- すべての SELECT は SQL のエイリアス（`AS userUuid` など）でキャメルケース化済み。ルータ層で再マッピング不要。
- `getResumableSession` / `getSessionDetail` は messages / emotions を同時取得して 1 メソッドで完結させる（往復削減）。
- `listSessionsByUser` のプレビューはサブクエリで取得 → N+1 を避ける。
- `insertEmotion` 後の戻りで `createdAt` を再取得しているが、`stListEmotions.all` で全件再取得しているのは **やや非効率**（[[wiki-linter]] のターゲット候補）。

## 関連

- [[db-driver]] — `db.prepare` の提供元
- [[db-schema]] — 対象テーブル
- [[prepared-statement-security]]（コンセプトページ。本リポジトリでは未作成。スキーマ違反検出時の補助）
- 利用側: [[route-user]] / [[route-sessions]] / [[route-emotions]] / [[route-history]]

## 出典

- `C:\ConsultationApplication\src\db\repo.js:12-241`
- DESIGN.md §5 / §6 / §7.4（参照）
