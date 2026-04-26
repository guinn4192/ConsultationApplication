---
type: entity
sources:
  - C:\ConsultationApplication\public\js\ui\emotion.js
updated: 2026-04-26
tags: [frontend, ui, emotion]
---

# ui-emotion

## 概要

5 段階絵文字セレクタの描画。`EMOJI_CHOICES`（1〜5）の定義を持ち、これを [[ui-summary]] / [[ui-history]] が `import` して再利用する。R3 対策として、assistant メッセージが `state === "done"` 遷移してから初めて描画する（[[emotion-trend-r6]]）。

## EMOJI_CHOICES

| value | emoji | label |
| ---: | --- | --- |
| 1 | 😢 | とてもつらい |
| 2 | 😟 | 不安 |
| 3 | 😐 | ふつう |
| 4 | 🙂 | 前向き |
| 5 | 😊 | とても前向き |

## 描画ロジック

`renderSelectorFor(messageId)`:
1. `state.getMessages()` から該当 message を取り出し、`role === "assistant"` かつ `state === "done"` 以外は何もしない
2. 既に直後に `.emotion-selector` があるなら冪等にスキップ
3. `<div.emotion-selector data-for-message=... role="group" aria-label="今の気持ちを記録する">` を構築し、message 要素の **直後** に `insertBefore`
4. 各ボタンに `aria-pressed`、`title`、`data-value`。現在値（`state.getEmotionForMessage(messageId)`）に応じて `.active`
5. クリック → 同値なら no-op（解除仕様無し）／違う値なら `state.recordEmotion(messageId, value)` → 兄弟ボタンの active を外して自分に付ける

## 起動

`initEmotionSelector()` を [[client-main]] が 1 度呼ぶ。以降は `state.onMessageDone` 購読が動作し、assistant の done 遷移時に自動描画。

## 関連

- [[client-state]] — `onMessageDone`、`recordEmotion`、`getEmotionForMessage`
- [[ui-chat]] — `getMessageEl(id)` で挿入位置を特定
- [[ui-summary]] / [[ui-history]] — `EMOJI_CHOICES` を再利用
- [[emotion-trend-r6]]

## 出典

- `C:\ConsultationApplication\public\js\ui\emotion.js:8-99`
