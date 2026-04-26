---
type: entity
sources:
  - C:\ConsultationApplication\public\js\main.js
updated: 2026-04-26
tags:
  - frontend
  - entry
  - bootstrap
---

# client-main

## 概要

クライアント側のエントリ（= エントリポイント。ブラウザが [[frontend-entry]] の `<script type="module" src="js/main.js">` 経由で最初にロード・実行する JS モジュール）。[[frontend-glossary#DOM|`DOMContentLoaded`]] で全モジュール（[[client-state]] / [[client-api]] / [[client-router]] / [[ui-shared]] / [[ui-chat]] / [[ui-emotion]] / [[ui-summary]] / [[ui-onboarding]] / [[ui-history]] / [[ui-resume]]）を初期化し、起動シーケンス・ルーター[[frontend-glossary#購読 (subscribe)|購読]]・送信ハンドラを束ねる。

なお SPA 全体としてのエントリは2階層に分かれる: **HTML エントリ** が [[frontend-entry]]（`public/index.html`）、**JS エントリ** が本ページの `public/js/main.js`。

## 初期化

[[frontend-glossary#DOM|`DOMContentLoaded`]] 内で:

1. 必要な [[frontend-glossary#DOM|DOM]] ref を `getElementById` / `querySelectorAll` で取得（[[frontend-entry]] が宣言した要素）
2. 各 UI モジュールを `init*` 呼び出しで[[frontend-glossary#配線 (wiring)|配線]]（コールバック経由で onComplete / onResume / onFreshStart / onResetClick を渡す）
3. `state.onEmotionRecorded` を[[frontend-glossary#購読 (subscribe)|購読]] → [[client-api]] `saveEmotion` を発火（DB 永続化、失敗時は `showPersistError` [[frontend-glossary#トースト (toast)|トースト]]）

## Bootstrap シーケンス

詳細: [[frontend-bootstrap]]

要約:
- UUID 無し → `navigate(ONBOARDING)` + `startRouter()`
- UUID あり → `getUser(uuid)`
  - 404 → `clearUser` + onboarding
  - その他のエラー → ログのみで継続（オフライン耐性）
- `getResumableSession()` → 結果あれば `showResumeModal(payload)`、無ければ welcome

## ルーター購読

`subscribeRoute(route => …)`:
- UUID 未取得かつ `route.name !== "onboarding"` → 強制 `navigate(ONBOARDING)`
- `name` で switch: `onboarding` / `history` / `historyDetail` / `root`
- 各画面の `*Only` ヘルパが他の画面を全部 hide する（modal も dismiss）

## 送信ハンドラ（`form.submit`）

1. `state.isStreaming()` 中は無視
2. 入力検証（空 / 1000 文字超）
3. `removeWelcomeMessage` / `state.ensureSessionId()`
4. **冪等な session 作成**: `createSession(currentSid)` を **fire-and-forget**（失敗してもサーバ側で `INSERT OR IGNORE`）
5. `addUserMessage` → `addMessage`
6. `consultStream` を起動（[[consult-stream-protocol]]）
   - `onDelta` 初回で `setLoading(false)` → `setStreaming(true)` → `addStreamingAssistantMessage` + `addStreamingMessage`
   - `onDone` で `replaceAssistantMessageId`（サーバ採番 ID）→ `markAssistantDone`（[[emotion-trend-r6]] §R3 で絵文字セレクタが描画される）
   - `persisted === false` なら `showPersistError("相談の記録の保存に失敗しました。")`
   - `onError` で部分描画を破棄しエラーメッセージを add

## 「新しい相談を始める」

- `newConsultationButton` クリック → `openSummary()`（[[ui-summary]]）→ ユーザーが「リセット」を選ぶと `performReset` が呼ばれる
- `performReset`: `closeSession(sid)` を **動的 import + fire-and-forget**（冪等。失敗は orphan close 任せ）→ `state.resetSession()` → UI 全クリア → welcome 再表示

## トースト

[[frontend-glossary#トースト (toast)|トースト]]実装: `showPersistError(msg)` — `#persist-error-toast` を `position: fixed` で挿入し 4 秒で fade。`role="alert"` / `aria-live="polite"`。

## 関連

- [[frontend-entry]] — DOM 元
- [[frontend-bootstrap]] — bootstrap の規約
- [[consult-stream-protocol]] — submit ハンドラ内 SSE
- [[ui-shared]] / [[ui-chat]] / [[ui-emotion]] / [[ui-summary]] / [[ui-onboarding]] / [[ui-history]] / [[ui-resume]] — 全画面モジュール
- [[client-state]] / [[client-api]] / [[client-router]]
- [[frontend-glossary]] — DOM / 配線 / 購読 / トーストなど汎用ウェブ用語

## 出典

- `C:\ConsultationApplication\public\js\main.js:1-440`
