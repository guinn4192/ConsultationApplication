---
type: concept
sources:
  - C:\ConsultationApplication\public\js\api.js
updated: 2026-04-26
tags: [sse, protocol, streaming]
---

# consult-stream-protocol

## 概要

`POST /api/consult/stream` の SSE プロトコル。クライアント実装は [[client-api]] の `consultStream(payload, handlers)` にある。**サーバ側のルータは `src/routes/` には存在せず**、別モジュール（おそらく `server.js` 内、または未取り込みのファイル）が提供する想定。Wiki 上は本ページがクライアント観点での仕様の正本となる。

## リクエスト

```
POST /api/consult/stream
Content-Type: application/json
x-user-uuid: <UUID>

{
  "messages": [{role, content}, ...],
  "category": "仕事" | null,
  "mode": "default" | "empathy" | "solution",
  "lastEmotion": 1..5 | null,
  "sessionId": "<uuid>",
  "userUuid": "<uuid>",
  "userMessageId": "<uuid>"
}
```

`messages` は [[client-state]] `getApiMessages()` の戻り（履歴を含む）、`lastEmotion` は最新の `emojiValue`（無ければ `null` で「中立扱い」）。

## レスポンス

`Content-Type: text/event-stream` を要求（クライアントは厳格にチェック）。フレームは `\n\n` 区切り、各行は `event:` または `data:` のプレフィックスを持つ。`event:` 既定値は `"message"`。

### イベント仕様

| `event:` | `data:` JSON | 用途 |
| --- | --- | --- |
| `delta` | `{ "text": "<差分文字列>" }` | 表示用ストリーミング差分。受信ごとに `accumulated += text` |
| `done` | `{ "reply"?: string, "assistantMessageId"?: string, "persisted"?: boolean }` | 終端。サーバ側で確定した本文・ID・DB 保存可否を伝える |
| `error` | `{ "error": "<message>" }` | 終端前のエラー通知。読み終えてから throw する |

`done` の各フィールド:
- `reply` … サーバが採用する最終本文。クライアントは accumulated を上書き
- `assistantMessageId` … サーバ採番。クライアントは `state.replaceAssistantMessageId(oldId, newId)` で差し替え（emotion の `messageId` も追従）
- `persisted` … `false` の場合、クライアントはトースト「相談の記録の保存に失敗しました。」を出す

## 二重タイムアウト

| 名称 | 定数 | 意味 |
| --- | --- | --- |
| Overall | `OVERALL_TIMEOUT_MS = 60000` | リクエスト発行から完了までの全体上限 |
| Idle | `IDLE_TIMEOUT_MS = 20000` | data 受信間隔の上限。**読込ごとに `resetIdleTimer()`** |

タイムアウト発火時は `timedOutReason` をセットして `abortController.abort()`。`AbortError` を catch 後、`timedOutReason` でユーザー向けメッセージに置き換える。

## エッジケース

- `streamStarted = false` のまま読了 → 「AIからの回答を取得できませんでした。しばらくしてからもう一度お試しください。」
- 非 `text/event-stream` ヘッダ → 「ストリーミングレスポンスを受信できませんでした。」
- `event: error` を受信 → 読了まで継続（バッファを使い切る）してから throw
- `cancel()` 呼出時は abort のみ。エラーは送出しない（呼出側責任）

## 関連

- [[client-api]] — 実装
- [[client-main]] — 唯一の呼び出し元（form.submit ハンドラ内）
- [[client-state]] — `getApiMessages` / `replaceAssistantMessageId`
- [[user-identification]] — `x-user-uuid` 自動付与（ただし SSE は手動で付ける）

## 出典

- `C:\ConsultationApplication\public\js\api.js:139-300`
