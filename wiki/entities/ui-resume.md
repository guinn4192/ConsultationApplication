---
type: entity
sources:
  - C:\ConsultationApplication\public\js\ui\resume.js
updated: 2026-04-26
tags: [frontend, ui, resume, feature-21]
---

# ui-resume

## 概要

Feature 21: 「中断した会話の再開」モーダル。サーバから受け取った `{session, messages, emotions}` を元に、ユーザーが「続きから」or「新しく始める」を選ぶ。詳細仕様は [[session-lifecycle]]。

## API

- `initResume(modalEl, { onResume, onFreshStart })` — 参照とコールバックを保持
- `showModal(payload)` — モーダル構築 + 表示。フォーカスを「続きから」ボタンに
- `dismiss()` — モーダル非表示

## モーダル UI

- カード（`role="dialog" aria-modal="true"`）
- 見出し: 「前回の続きから？」
- 本文: 先頭 message から **40字プレビュー** を抽出（41字以上は `…` 付与）
- メタ: `やり取り N 件 / 気分記録 M 件`
- 2 ボタン:
  - **続きから** → `performResume(payload)` → `dismiss()` → `onResume()`
  - **新しく始める** → `performFresh(session)` → `dismiss()` → `onFreshStart()`

## `performResume` 処理（§7.6）

1. `state.setSessionId(session.id)` で **サーバ側 ID に完全上書き**
2. `state.restoreFromServer({sessionId, messages, emotions})` で全注入（messages は `state: "done"` 固定）
3. `clearMessages()` + `removeWelcomeMessage()`
4. messages を順に `addMessage(content, type, id)` で描画。assistant 発言に対しては `renderSelectorFor(id)` を **直接呼ぶ**（`onMessageDone` ルートを経由しない — `restoreFromServer` 時点で `state: "done"` 化済み）
5. `.active` の復元は `renderSelectorFor` 内の `state.getEmotionForMessage` 参照で自動

## `performFresh` 処理

1. `closeSession(session.id)` を await（失敗は冪等なので無視 — orphan close で埋まる）
2. `state.resetSession()`

## 関連

- [[client-state]] — `setSessionId` / `restoreFromServer` / `resetSession`
- [[client-api]] — `closeSession`
- [[ui-chat]] / [[ui-emotion]] — 描画系
- [[route-sessions]] — 対向の resumable / close
- [[session-lifecycle]]

## 出典

- `C:\ConsultationApplication\public\js\ui\resume.js:17-161`
