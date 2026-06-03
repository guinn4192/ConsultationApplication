---
type: entity
sources:
  - C:\ConsultationApplication\public\js\ui\templateConfirm.js
updated: 2026-06-04
tags: [frontend, ui, templates, modal, feature-23, sprint-9]
---

# ui-template-confirm

## 概要

Sprint 9 / Feature 23: テンプレ挿入時に **既入力と衝突する場合** に表示する置き換え確認モーダル。「入力内容を置き換えますか？」を尋ね、`confirm()` が `Promise<boolean>`（`true`=置き換える / `false`=キャンセル）を返す。[[ui-resume]] / [[ui-summary]] のモーダル流儀（カスタムモーダル + フォーカストラップ + Escape）を踏襲。

## API

- `initTemplateConfirm(modalEl)` — `#template-confirm-modal`（[[frontend-entry]]）の DOM 配線を1度だけ行う。`[data-action="cancel"]` / `[data-action="confirm"]` ボタン、`.template-confirm-modal-backdrop` を取得
- `confirm()` — モーダルを表示し resolve を待つ。`Promise<boolean>` を返す

## 挙動

- **キャンセル系はすべて `resolve(false)` に集約**: 「キャンセル」ボタン / 背景クリック / Escape キー / モーダル直接クリック
- 「置き換える」ボタン → `resolve(true)`
- デフォルトフォーカスは **「キャンセル」ボタン**（誤 Enter で入力を破壊しない保守的デフォルト）。表示完了後 `setTimeout(…, 0)` で確実に当てる
- Tab フォーカストラップ: キャンセル ⇄ 置き換える の2ボタン間で循環
- 表示前のフォーカス元（テンプレボタン等）を記憶し、閉じた後に `focus()` で戻す
- 連続呼び出し時は直前の Promise を `false` で解決してから新規受付（多重表示防止）

## フェイルセーフ

- モーダル DOM 未配線（`initTemplateConfirm` 未呼び出し / 要素欠落）の場合、`confirm()` は `console.warn` の上で `Promise.resolve(false)` を返す → テンプレ挿入は安全側（キャンセル相当）に倒れる

## 想定 DOM 構造

```html
<div id="template-confirm-modal" hidden role="dialog" aria-modal="true">
  <div class="template-confirm-modal-backdrop"></div>
  <div class="template-confirm-modal-content">
    <h3 id="template-confirm-title">入力内容を置き換えますか？</h3>
    <p>現在入力中の内容は失われます。…</p>
    <div class="template-confirm-modal-actions">
      <button data-action="cancel">キャンセル</button>
      <button data-action="confirm">置き換える</button>
    </div>
  </div>
</div>
```

## 関連

- [[ui-templates]] — `insertTemplate` が既入力衝突時に `confirm()` を await する呼び出し元
- [[client-main]] — `initTemplateConfirm(templateConfirmModal)` を `initTemplates` より先に配線
- [[frontend-entry]] — `#template-confirm-modal` の DOM 本体
- [[frontend-style]] — `.template-confirm-modal*` の CSS
- [[ui-resume]] / [[ui-summary]] — 同系のカスタムモーダル流儀

## 出典

- `C:\ConsultationApplication\public\js\ui\templateConfirm.js:1-155`
