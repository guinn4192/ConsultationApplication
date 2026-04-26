---
type: entity
sources:
  - C:\ConsultationApplication\public\js\state.js
updated: 2026-04-26
tags: [frontend, state, store]
---

# client-state

## 概要

クライアント側の **single source of truth**。`state.js` が一枚岩のモジュールで、内部状態 `_state` は外部から直接書けない（`export const state` 経由でのみ）。Sprint 7 で localStorage 永続化と購読パターンが追加された。

## 内部状態（`_state`）

| キー | 型 | 用途 |
| --- | --- | --- |
| `userUuid` | string \| null | 起動時に `localStorage("consultationApp.userUuid")` から読込 |
| `userName` | string \| null | 同 `consultationApp.userName` |
| `sessionId` | string \| null | 初回送信時または resume 時に採番／上書き |
| `sessionMessages` | `{id,role,content,mode,category,createdAt,state}[]` | 発言の append-only ログ。`state: "streaming" \| "done"` |
| `emotions` | `{id,messageId,emojiValue,createdAt}[]` | append-only。最新採用は読み取り側が担う |
| `isStreaming` | boolean | UI ロック判定 |
| `selectedCategory` | string \| null | カテゴリ |
| `selectedMode` | string | `default` / `empathy` / `solution` |

## 購読 API

- `onMessageDone(cb)` — assistant の `state` が `"done"` 遷移時に発火（[[emotion-trend-r6]] §R3 対策）
- `onEmotionRecorded(cb)` — `recordEmotion` 後に発火、`{messageId, emojiValue, sessionId}` を渡す（[[client-main]] が DB POST に配線）

## 主要メソッド

### 識別
- `setUserUuid(uuid)` / `setUserName(name)` / `clearUser()` — localStorage と同期
- `getUserUuid()` / `getUserName()`

### セッション
- `ensureSessionId()` — 無ければ `genUuid()` で採番。`crypto.randomUUID` がなければ RFC4122 v4 相当のフォールバック
- `setSessionId(id)` — Feature 21 で resume 時にサーバ側 ID へ上書き
- `resetSession()` — `sessionId` / `sessionMessages` / `emotions` / `isStreaming` をクリア。`userUuid` / `userName` は **保持**

### メッセージ
- `addUserMessage(content)` → id を返す
- `addStreamingAssistantMessage()` → id（`state: "streaming"`）
- `updateStreamingAssistant(id, newContent)`
- `replaceAssistantMessageId(oldId, newId)` — サーバ採番 ID で **client側 id を差し替え**。emotion の `messageId` も追従
- `markAssistantDone(id, finalContent)` — `state: "done"` に遷移して購読者を呼ぶ
- `removeMessage(id)` — エラー時の枠破棄
- `getApiMessages()` — `{role, content}` のみの配列を返す（Claude API 用）

### 感情
- `recordEmotion(messageId, emojiValue)` → 新規レコード生成 + `onEmotionRecorded` 発火
- `getLastEmotionValue()` — 直近1件の `emojiValue`（[[client-main]] が `lastEmotion` として送る）
- `getEmotionForMessage(id)` — 末尾から走査して最新 1 件

### 復元
- `restoreFromServer({sessionId, messages, emotions})` — Feature 21 再開時。messages は `state: "done"` 固定で投入、emotions は `createdAt` でソート

## localStorage キー

- `consultationApp.userUuid`
- `consultationApp.userName`

（テーマは [[ui-shared]] が `theme` キーを別途管理）

## 関連

- [[client-main]] — 全モジュールの結節点。リスナを束ねる
- [[client-api]] — `getUserUuid()` を毎回参照してヘッダ付与
- [[ui-emotion]] — `onMessageDone` 購読
- [[ui-resume]] — `restoreFromServer` 呼出元
- [[emotion-trend-r6]]
- [[frontend-bootstrap]]

## 出典

- `C:\ConsultationApplication\public\js\state.js:1-322`
