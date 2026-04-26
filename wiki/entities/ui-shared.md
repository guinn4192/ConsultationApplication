---
type: entity
sources:
  - C:\ConsultationApplication\public\js\ui\shared.js
updated: 2026-04-26
tags: [frontend, ui, theme]
---

# ui-shared

## 概要

UI 横断の共通処理: テーマ切替、モード/カテゴリ切替、文字数表示、ローディング表示、新相談ボタンの活性制御を集約する。`initShared(refs)` で 1 度だけ DOM を配線し、以降は関数 export で操作する。

## 定数

- `MAX_CHARS = 1000` — 入力上限
- `WARN_THRESHOLD = 900` — 警告閾値
- `MODE_DESCRIPTIONS = { default, empathy, solution }` — モード説明文。default は「共感とアドバイスをバランスよく提供します」

## テーマ切替（[[theming-system]]）

- 起動時に `localStorage("theme")` を読み、あれば `<html data-theme="...">` を設定して該当ボタンに `.active`
- ボタンクリック: `data-theme` を読み、`default` のときは `removeAttribute + removeItem`、それ以外は `setAttribute + setItem`

## モード / カテゴリ

- モードボタン: 排他選択（active 1つ）。`state.setSelectedMode(value)` + 説明文を `MODE_DESCRIPTIONS[value]` で更新
- カテゴリボタン: **同じカテゴリを再クリックで解除**（`state.setSelectedCategory(null)`）。それ以外は排他選択

## 文字数 / 送信ボタン

`updateCharCount`:
- `len > MAX_CHARS` → `.over` + `sendButton.disabled = true`
- `len >= WARN_THRESHOLD` → `.warning`、ストリーミング中/ロード中でなければ送信可
- それ以外 → 通常表示

`updateNewConsultationButton`:
- ストリーミング中は無効化
- それ以外は **発言数 0 件で無効化**（welcome 表示時は押せない）

## キーバインド

`Enter` で送信、`Shift+Enter` で改行（textarea 上の `keydown` で `form` の `submit` を発火）。

## 状態セット

- `setLoading(on)` — `#loading-indicator` の挿入/除去 + `sendButton` / `input` / `newConsultationButton` の活性制御
- `showError(msg)` / `clearError()` — `#error-message` の表示
- `resetModeAndCategoryUi()` — `state.setSelectedCategory(null)`, `setSelectedMode("default")`、ボタン active を全解除し default を再選択、入力をクリア

## 関連

- [[client-main]] — `initShared` 呼出元
- [[client-state]]
- [[theming-system]]
- [[frontend-style]]

## 出典

- `C:\ConsultationApplication\public\js\ui\shared.js:6-207`
