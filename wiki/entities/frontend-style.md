---
type: entity
sources:
  - C:\ConsultationApplication\public\style.css
updated: 2026-04-26
tags: [frontend, css, style, theme]
---

# frontend-style

## 概要

唯一のスタイルシート（1690行）。CSS 変数で 5 テーマを切り替え、SVG `<filter>` 参照で「鉛筆＋方眼ノート」風の質感を出す。詳細な配色・フィルタ仕様は [[theming-system]] に切り出し済み。本ページは構造インデックスとして機能する。

## ファイル構造（行範囲）

| 範囲 | 内容 |
| --- | --- |
| `:1-7` | reset |
| `:10-108` | テーマ定義（`:root` + `[data-theme="ocean|forest|night|sakura"]`） |
| `:114-149` | base (body, sketch-filters, sk-border helper) |
| `:152-283` | header / theme buttons / new-consultation-button |
| `:286-318` | chat container（grid 罫線背景は inline SVG data URI） |
| `:321-466` | message bubbles / loading / streaming cursor |
| `:469-669` | input area（mode/category/textarea/send button/error） |
| `:672-718` | レスポンシブ（@600px / @1280px） |
| `:721-808` | emotion selector（Feature 14） |
| `:811-1025` | summary modal（Feature 16） |
| `:1032-1196` | header user row / onboarding screen（Feature 18） |
| `:1198-1506` | history screen + detail + emotion track（Feature 20） |
| `:1509-1617` | resume modal（Feature 21） |
| `:1620-1644` | persist error toast |
| `:1646-1689` | mobile 調整（@600px） |

## 重要な変数・パターン

- カラー: `--color-paper` / `--color-ink` / `--color-accent` / `--color-user-accent` / `--color-text` 系
- フォント: `--font-hand`（Klee One）、`--font-script`（Caveat）
- グリッド: `--grid-line`（chat 背景の罫線）
- フィルタ: `filter: url(#rough|#rough-heavy|#rough-underline)`（[[frontend-entry]] が定義）
- `.sk-border` ヘルパ — `::before` で rough border を描画する共通パターン

## 関連

- [[theming-system]] — テーマ追加・SVG filter の意図
- [[frontend-entry]] — `<filter>` の SVG 本体
- 各画面: [[ui-onboarding]] / [[ui-history]] / [[ui-resume]] / [[ui-summary]] / [[ui-emotion]]

## 出典

- `C:\ConsultationApplication\public\style.css:1-1690`
