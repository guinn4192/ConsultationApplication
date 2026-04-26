---
type: entity
sources:
  - C:\ConsultationApplication\public\js\ui\chat.js
updated: 2026-04-26
tags: [frontend, ui, chat]
---

# ui-chat

## 概要

チャット領域の DOM ロジック。welcome / 通常メッセージ / ストリーミング中メッセージの3形態を扱う。各 message DOM は `data-message-id` を持ち、[[ui-emotion]] の絵文字セレクタが id 経由で紐づく。

## API

- `initChat(chatMessagesEl)` — `#chat-messages` への参照を保持（[[client-main]] が呼ぶ）
- `scrollToBottom()` — `scrollTop = scrollHeight`
- `showWelcomeMessage()` — `#welcome-message` を挿入（4段ガイド付き）。multi-line は `\n` をそのまま `<span>` に流す（`white-space: pre-wrap` 想定）
- `removeWelcomeMessage()`
- `clearMessages()` — `innerHTML = ""`
- `addMessage(text, type, id)` — `type: "user" | "ai" | "error"`。エラーは label 無し中央寄せ
- `addStreamingMessage(id)` → `{ root, content }` — streaming 中の枠を返し、本文 span への参照を渡す
- `markStreamingDone(rootDiv)` — `.streaming-done` 付与（CSS でカーソル点滅停止）
- `getMessageEl(id)` — `[data-message-id="..."]` セレクタで要素を取得（`CSS.escape` で id をエスケープ）

## クラス命名

- `.message` ベース
- `.message-user` / `.message-ai` / `.message-welcome` / `.message-error` / `.message-streaming` / `.streaming-done`
- `.message-label`（差出人ラベル）、`.message-streaming-content`（ストリーミング中の本文 span）

## 関連

- [[client-main]] — submit ハンドラから streaming 描画を制御
- [[ui-emotion]] — `getMessageEl(id)` を使ってセレクタ挿入位置を特定
- [[ui-resume]] — `clearMessages` + `addMessage` で復元
- [[frontend-style]]

## 出典

- `C:\ConsultationApplication\public\js\ui\chat.js:1-130`
