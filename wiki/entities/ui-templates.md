---
type: entity
sources:
  - C:\ConsultationApplication\public\js\ui\templates.js
  - C:\ConsultationApplication\public\js\data\templates.js
updated: 2026-06-04
tags: [frontend, ui, templates, feature-23, sprint-9]
---

# ui-templates

## 概要

Sprint 9 / Feature 23: 「相談テンプレート」。入力欄の上に並ぶ穴埋め式チップ群（[[frontend-entry]] の `.template-section`）をクリックすると、`#message-input` に定型文を挿入し、本文中の `___` プレースホルダーを範囲選択してすぐ続きを打てる状態にする。挿入ロジック（`ui/templates.js`）と静的辞書（`data/templates.js`）の2ファイルで構成。

**設計上の厳守事項**: テンプレ機能は state を一切持たず（[[client-state]] や localStorage に書かない）、`setSelectedCategory()` / `.category-button.active` も操作しない（DESIGN §7.9.3 / R13）。純粋な入力欄への文字列挿入のみ。

## 静的辞書（`data/templates.js`）

`export const TEMPLATES` — 5件の定型文。各エントリ:

| id | label | recommendedCategory |
| --- | --- | --- |
| `workplace` | 職場の人間関係 | 人間関係 |
| `family` | 家族との関係 | 人間関係 |
| `career` | 進路・キャリア | 仕事 |
| `health` | 健康・体調の不安 | 健康 |
| `vague` | 漠然とした不安 | null |

- `body`: 挿入される本文。必ず1箇所の `___`（U+005F × 3）プレースホルダーを含む
- `placeholder: { start, end }`: `body` 中の `___` の半開区間。`body.slice(start, end) === "___"` が成立すること
- `recommendedCategory`: 将来拡張用。Sprint 9 では UI 未使用
- `getTemplateById(id)`: id 引き。未知 id / 非文字列は `null`
- `__validate()`: 全エントリで `body.slice(start, end) === "___"` を検証。**モジュール読み込み時に1度だけ自己実行**（`selfCheck` IIFE）し、辞書編集ミスを throw で即時検出する

## 挿入 UI（`ui/templates.js`）

### API

- `initTemplates({ container, input, getIsStreaming, confirmReplace })` — `.template-button` を全件 click バインド（静的 DOM なので起動時1度のみ）
  - `getIsStreaming`: `() => state.isStreaming()` を渡す
  - `confirmReplace`: [[ui-template-confirm]] の `confirm` を渡す
- `insertTemplate(templateId, options?)` — 挿入の本体（async）
- `__getLastInsertedBody()` / `__resetLastInsertedBody()` — テスト用

### `insertTemplate` シーケンス（§7.9.2 順序厳守）

1. `input` 未取得 / ストリーミング中（`getIsStreaming()`）/ 未知 id → 無音で early return
2. 既入力判定:
   - 空欄（`trim()` で空）→ 確認なしで挿入（受入基準 #13）
   - `lastInsertedBody` と完全一致（＝直前挿入のまま手入力なし）→ 確認なしでテンプレ A→B 切替（#14）
   - それ以外（手入力あり）→ `confirmReplace()` を await。`false`（キャンセル）なら `input.value` を変更せず return（#11）
3. `input.value = template.body`
4. **`input` イベントを明示 dispatch**（R12: 文字数カウンタ・送信ボタン活性化・既存リスナ連動。これを忘れると UI が追従しない）
5. `input.focus()` → `setSelectionRange(start, end)` で `___` を範囲選択（次のキー入力で上書き / #5・#6）
6. `lastInsertedBody = template.body` に更新

`lastInsertedBody` はモジュールスコープ変数。「ユーザーが手入力していない」判定に使い、テンプレ間の連続切替で確認モーダルを出さないための記憶。

## 関連

- [[ui-template-confirm]] — 既入力衝突時に呼ばれる置き換え確認モーダル
- [[client-main]] — `initTemplateConfirm` → `initTemplates` の順で配線（DESIGN §8.4 ステップ5）
- [[frontend-entry]] — `.template-section` / `.template-button[data-template-id]` の DOM 元
- [[frontend-style]] — `.template-section` / `.template-button` の CSS（既存 `.category-button` と同等の見た目）
- [[client-state]] — `isStreaming()` のみ参照（書き込みは一切しない）
- [[ui-chat]] — 挿入先 `#message-input` を含む入力エリア

## 出典

- `C:\ConsultationApplication\public\js\ui\templates.js:1-161`
- `C:\ConsultationApplication\public\js\data\templates.js:1-100`
- `C:\ConsultationApplication\specs\SPEC.md` Feature 23
