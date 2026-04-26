---
type: entity
sources:
  - C:\ConsultationApplication\src\routes\emotions.js
updated: 2026-04-26
tags: [routes, emotions, api]
---

# route-emotions

## 概要

感情記録の Express ルータ。`createEmotionsRouter(repo)`。`/api/emotions` 配下に1エンドポイント。

## エンドポイント

### `POST /api/emotions`

- 認証: [[user-identification]]（ヘッダ優先 + body `userUuid` フォールバック）
- body: `{ sessionId, messageId|null, emojiValue }`
- バリデーション
  - `sessionId` 文字列必須
  - `emojiValue` は **整数 1〜5**（`Number.isInteger` + 範囲）
- 認可
  - `repo.getSession(sessionId)` で `404` 判定
  - `session.userUuid !== userUuid` で `403`
- 成功: `201 { id, createdAt }`（`repo.insertEmotion` の戻り）

`messageId` は string 以外なら `null` に正規化される（ぶら下がり emotion を許容）。これは [[db-table-emotion-records]] の `ON DELETE SET NULL` と整合。

## 関連

- [[db-repo]] — `getSession` / `insertEmotion`
- [[db-table-emotion-records]]
- [[user-identification]]
- 呼び出し元: [[client-api]] `saveEmotion`、[[client-main]]（`state.onEmotionRecorded` 購読経由）、[[ui-emotion]]（クリックで `state.recordEmotion` → 上記購読が発火）

## 出典

- `C:\ConsultationApplication\src\routes\emotions.js:15-63`
