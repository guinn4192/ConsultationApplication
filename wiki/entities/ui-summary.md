---
type: entity
sources:
  - C:\ConsultationApplication\public\js\ui\summary.js
updated: 2026-04-26
tags: [frontend, ui, summary, feature-16]
---

# ui-summary

## 概要

Feature 16: 「本日の変化」モーダル。「新しい相談を始める」ボタン押下時に **即リセットせず** これを先に開く（[[client-main]] §performReset 前のフック）。気分推移3点を `floor(N/2)` で中盤を取り可視化（[[emotion-trend-r6]] R6）。

## API

- `initSummary(modalEl, { onResetClick })` — 参照とコールバックを保持。ESC + 背景クリックで閉じる
- `open()` — 中身を毎回再構築して表示（最新の `state.getEmotions()` を使う）
- `close()` — モーダル非表示

## 描画

`compute(emotions)`:
- 0件 → `points: []`
- 1件 → `[{label:"最初", value: emotions[0].emojiValue}]`
- 2件以上 → first / `emotions[floor(N/2)]` / last の3点

`trendIcon(from, to)`:
- 上昇 `↗`, 下降 `↘`, 同値 `→`
- それぞれに 「気持ちが上向きました」「気持ちが下がりました」「気持ちは保たれています」のラベル

レイアウト:
- `.summary-track` 内に `.summary-point` （ラベル / 絵文字 / サブテキスト）を並べ、隣接間に `.summary-change-arrow.summary-change-{up|down|flat}`
- 最後にキャプション（first vs last の trendIcon、または 1件のときは固定文言）

## アクション

- 「リセットして新しい相談を始める」→ `close()` + `onResetClick()` 呼出（[[client-main]] §performReset へ繋がる）
- 「閉じる」→ `close()` のみ

## 関連

- [[ui-emotion]] — `EMOJI_CHOICES` を import
- [[client-state]] — `getEmotions()`
- [[client-main]] — `onResetClick` の実体（performReset）
- [[emotion-trend-r6]]

## 出典

- `C:\ConsultationApplication\public\js\ui\summary.js:1-191`
