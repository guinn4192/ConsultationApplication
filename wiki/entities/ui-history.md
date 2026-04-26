---
type: entity
sources:
  - C:\ConsultationApplication\public\js\ui\history.js
updated: 2026-04-26
tags: [frontend, ui, history, feature-20]
---

# ui-history

## 概要

Feature 20: 過去の相談履歴の **閲覧専用** 画面（一覧 + 詳細）。編集・削除は無い。日付別グルーピングと気分推移3点（[[emotion-trend-r6]] R6）の可視化を担う。

> **同名ファイル注意**: `history.js` という名前のファイルはプロジェクト内に2つある。本ページは UI 側 `public/js/ui/history.js`。API 側 `src/routes/history.js` は [[route-history]] を参照。呼び出し関係は `ui-history → [[client-api]] (listHistory / getHistoryDetail) → [[route-history]] → [[db-repo]]`。

## 公開 API

- `initHistory(screen)` — `#history-screen` への参照を保持
- `showList()` — 一覧表示（[[client-api]] `listHistory`）
- `showDetail(sessionId)` — 詳細表示（[[client-api]] `getHistoryDetail`）
- `hide()` — 隠して `innerHTML = ""`

## 一覧画面

- ヘッダ: `← 相談画面に戻る` + `<h2>過去の相談履歴`
- 空: `「まだ相談履歴はありません。」`
- 日付別グループ化: `formatDateOnly(startedAt)` を Map で分類し、`<section.history-group>` に `<h3.history-group-date>` + `<ul.history-session-list>`
- 各セッションは `<button.history-session-button>` (grid: 時刻 / プレビュー / 状態)
  - 状態は `closedAt` で「完了」/「継続中」（`is-open` クラス）
  - クリックで `navigate("#/history/<encoded id>")`
- エラー: `<p.history-error>`

## 詳細画面

- ヘッダ: `← 履歴一覧に戻る`
- 失敗系の表示: `null` / `forbidden` / 例外 → エラー文言
- **気分推移セクション** (`renderEmotionTrack`):
  - 0件 → 「このセッションでは気分の記録がありません。」
  - 1件 → 「最初」のみ
  - 2件以上 → `floor(N/2)` で中盤を取り「はじめ → 中盤 → いま」（[[emotion-trend-r6]]）
  - 矢印は `up`(↗) / `down`(↘) / `flat`(→)
  - 注記: `このセッションで押された気分ボタンの記録 N 件から作成しています。`
- **発言一覧**: 各 message に対して、対応する **最新 emoji**（`message_id` ごとに `createdAt` 最大）を assistant 発言にだけ "記録: 😊 前向き" の形で付与（§7.6 最新採用）

## 日付フォーマット

- `formatDate(iso)` → `YYYY-MM-DD HH:mm`
- `formatDateOnly(iso)` → `YYYY-MM-DD`
- `Date` パース不可は元の文字列を返す（フォールバック）

## 関連

- [[route-history]] — 同名 `history.js`（API 側）。本ページの UI が叩くエンドポイントの実装
- [[client-api]] — `listHistory` / `getHistoryDetail`
- [[client-router]] — `navigate(#/history/<id>)`
- [[ui-emotion]] — `EMOJI_MAP`（emojiValue → emoji/label）はこのファイルに別に定義されているが [[ui-emotion]] の `EMOJI_CHOICES` と内容は一致
- [[emotion-trend-r6]]

## 出典

- `C:\ConsultationApplication\public\js\ui\history.js:1-368`
