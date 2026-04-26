---
type: concept
sources:
  - C:\ConsultationApplication\public\style.css
  - C:\ConsultationApplication\public\index.html
  - C:\ConsultationApplication\public\js\ui\shared.js
updated: 2026-04-26
tags: [theme, css, sketchy, ui]
---

# theming-system

## 概要

5 テーマ（default / ocean / forest / night / sakura）を CSS 変数で切り替える方式。さらに SVG `<filter>` を `filter: url(#rough)` 等で参照することで「鉛筆＋方眼ノート」風の質感を出す（"sketchy" デザイン）。テーマと sketchy filter は独立した直交軸。

## テーマ

| `data-theme` | UI ラベル | コンセプト |
| --- | --- | --- |
| （未設定） | 🍂 ぬくもり | default。ベージュ＋茶の温かい配色 |
| `ocean` | 🌊 やすらぎ | 青系、落ち着き |
| `forest` | 🌿 いやし | 緑系、リラックス |
| `night` | 🌙 よるのしじま | ダークモード |
| `sakura` | 🌸 はなごころ | ピンク系、やさしい |

## 切替のメカニズム

1. ボタンに `data-theme="<name>"`（[[frontend-entry]] のヘッダ内）
2. [[ui-shared]] が `localStorage("theme")` を読み起動時に `<html data-theme="...">` を設定
3. クリック時:
   - `default` → `removeAttribute + removeItem`（=変数のリセット）
   - それ以外 → `setAttribute + setItem`
4. CSS は `:root` で default の変数を、`[data-theme="..."]` で override

## 主要な CSS 変数

```
--color-paper       /* 背景 */
--color-header-paper
--color-ink         /* 主線・本文 */
--color-ink-soft / --color-ink-faint
--color-accent / --color-accent-hover
--color-user-accent / --color-user-bubble
--color-ai-bubble
--color-input-bg
--color-error / --color-error-bg
--color-text / --color-text-light
--grid-line         /* チャット背景の罫線 */
--font-hand         /* Klee One（本文） */
--font-script       /* Caveat（見出し） */
--radius
```

## Sketchy フィルタ

[[frontend-entry]] が SVG で 3 つの `<filter>` を定義:

| id | 用途 | パラメータ要点 |
| --- | --- | --- |
| `rough` | 通常の歪み（境界線、ボタン、アイコン） | `feTurbulence baseFrequency=0.03 numOctaves=4` + `feDisplacementMap scale=3` |
| `rough-heavy` | 強めの歪み（カード境界、入力枠） | `baseFrequency=0.025 numOctaves=3 scale=5` |
| `rough-underline` | 下線専用 | `baseFrequency=0.08 numOctaves=2 scale=2` |

CSS では `filter: url(#rough)` で参照。要素を境界線として使うときは **`::before` overlay パターン**（[[frontend-style]] `.sk-border` ヘルパ）を採用し、本体の `border` ではなく ::before の `border` にフィルタを掛ける。これにより本体のレイアウトは破綻しない。

## チャット背景

`.chat-messages` に inline SVG data URI で 28×28 の方眼罫線を配置。テーマごとに `--grid-line` の色だけ差し替えるため、`background-image` を 5 種類書いている（`[data-theme="..."] .chat-messages`）。

## アクセシビリティ配慮

- `.theme-button` に `title="<コンセプト>"`
- ダークモード（night）のみ追加で `--color-error: #f38ba8` 等を明示上書き
- 一部の状態（emotion-button.active 等）も night 専用 override あり

## 関連

- [[frontend-style]] — 実体
- [[frontend-entry]] — `<filter>` 本体
- [[ui-shared]] — テーマ切替ロジック
- [[spa-architecture]]

## 出典

- `C:\ConsultationApplication\public\style.css:10-108`（テーマ定義）
- `C:\ConsultationApplication\public\style.css:132-149`（`.sk-border` ヘルパ）
- `C:\ConsultationApplication\public\index.html:13-28`（`<filter>` 定義）
- `C:\ConsultationApplication\public\js\ui\shared.js:42-64`（切替ロジック）
