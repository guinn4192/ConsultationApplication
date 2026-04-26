---
type: concept
sources:
  - C:\ConsultationApplication\public\js\state.js
  - C:\ConsultationApplication\public\js\ui\emotion.js
  - C:\ConsultationApplication\public\js\ui\summary.js
  - C:\ConsultationApplication\public\js\ui\history.js
updated: 2026-04-26
tags: [emotion, design-rule, ui]
---

# emotion-trend-r6

## 概要

DESIGN.md の **R3**（絵文字セレクタの描画タイミング）と **R6**（気分推移3点の中盤算出）の2規約をまとめたページ。クライアント側の複数モジュールに分散しているが、起点は1つの設計原則なので合成する。

## R3: 絵文字セレクタの描画タイミング

> **assistant メッセージは `state === "done"` 遷移後に初めてセレクタを描画する。streaming 中は描画しない。**

理由: ストリーミング中の不確定な本文に対してユーザーが感情ラベルを付けると、後続の delta によって本文が変化したときに「何に対する感情か」が曖昧になる。

実装:
- [[client-state]] の `markAssistantDone(id, finalContent)` が `state` を `"done"` に遷移し `_listeners.messageDone` の購読者を呼ぶ
- [[ui-emotion]] の `initEmotionSelector()` が `state.onMessageDone` を購読
- 購読者は `renderSelectorFor(messageId)` を呼ぶ。`renderSelectorFor` は安全側で `role === "assistant" && state === "done"` を再判定するので、誤呼び出しでも壊れない
- [[ui-resume]] の `performResume` は **購読ルートを通さず** `renderSelectorFor` を直接呼ぶ。`restoreFromServer` 時点で `state: "done"` 化済みなので問題ない

## R6: 気分推移は `floor(N/2)` で「中盤」を取る

> **気分推移を3点で要約するとき、開始＝先頭、最終＝末尾、中盤＝`emotions[Math.floor(N/2)]`（0 始まり）。**

実装:
- [[ui-summary]] `compute(emotions)`:
  ```js
  const middleIdx = Math.floor(n / 2); // DESIGN §4.3 R6
  ```
- [[ui-history]] `renderEmotionTrack(emotions)`: 同じく `Math.floor(n / 2)`

特殊ケース:
- N=0 → 「気持ちの記録がありません」
- N=1 → 「最初」のみ表示（中盤・最終は無し）
- N≥2 → 「はじめ」「中盤」「いま」の3点を表示

矢印は隣接2点の比較で決定（`up` / `down` / `flat`）。**全体評価は first vs last のみ**。

## 共有された定義

5 段階の `emojiValue` ↔ emoji ↔ label の対応表は [[ui-emotion]] `EMOJI_CHOICES` に正本があり、[[ui-summary]] / [[ui-history]] が `import` または同形のローカル `EMOJI_MAP` で再現する。値の整合性は DB CHECK（[[db-table-emotion-records]] `emoji_value BETWEEN 1 AND 5`）で担保。

## 関連

- [[ui-emotion]] / [[ui-summary]] / [[ui-history]] — R3 / R6 の使用箇所
- [[client-state]] — `onMessageDone` 購読パターン
- [[ui-resume]] — `restoreFromServer` 経路の例外的な扱い
- [[db-table-emotion-records]]

## 出典

- `C:\ConsultationApplication\public\js\state.js:218-234`（`markAssistantDone`）
- `C:\ConsultationApplication\public\js\ui\emotion.js:91-97`（`initEmotionSelector`）
- `C:\ConsultationApplication\public\js\ui\summary.js:34-54`（R6 中盤算出）
- `C:\ConsultationApplication\public\js\ui\history.js:271-360`（R6 中盤算出 + 推移描画）
