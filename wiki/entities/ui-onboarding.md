---
type: entity
sources:
  - C:\ConsultationApplication\public\js\ui\onboarding.js
updated: 2026-04-26
tags: [frontend, ui, onboarding, feature-18]
---

# ui-onboarding

## 概要

Feature 18: ユーザー名入力画面。サーバが UUID を発行し、クライアントは `localStorage` に永続化する（[[client-state]] §識別）。パスワード/メールアドレス無しの単一識別モデル（[[user-identification]]）。

## API

- `initOnboarding(screenEl, { onComplete })` — 画面要素と完了コールバックを保持
- `show()` — onboarding カードを構築して表示。autoFocus
- `hide()` — `hidden = true` + `innerHTML = ""`

## 入力フォーム

- `<input #onboarding-name-input maxLength=50 autocomplete="off" required>`
- バリデーション
  - trim 後に空 → `errorEl` に「お名前を入力してください。」
  - 50 文字超 → 「50文字以内で入力してください。」（[[db-table-users]] の CHECK と一致）
- 送信処理:
  1. submit 無効化 + ボタン文言「登録中...」
  2. [[client-api]] `registerUser(name)` → `{ uuid, userName }`
  3. `state.setUserUuid(uuid)` + `state.setUserName(userName)`（localStorage に同期）
  4. `onComplete()` を呼ぶ（[[client-main]] が hide + ヘッダ更新 + ROOT へ navigate + welcome 表示）
- 失敗時: ボタンを再活性化、エラー文言を表示

## 関連

- [[route-user]] — 対向（`POST /api/user/register`）
- [[client-state]] — UUID/userName 永続化
- [[client-main]] — `onComplete` ハンドラ
- [[user-identification]]

## 出典

- `C:\ConsultationApplication\public\js\ui\onboarding.js:10-117`
