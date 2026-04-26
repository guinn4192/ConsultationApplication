---
type: entity
sources:
  - C:\ConsultationApplication\public\index.html
updated: 2026-04-26
tags: [frontend, html, entry]
---

# frontend-entry

## 概要

シングルページアプリの唯一の HTML エントリ。Google Fonts (Klee One / Caveat) の preconnect、SVG `<filter>` 定義、各画面コンテナと共通モーダルを宣言する。`<script type="module" src="js/main.js">` で [[client-main]] を読み込む（ビルドレス、ESM）。

## 主要な DOM 構造

- `<svg class="sketch-filters">`: `#rough` / `#rough-heavy` / `#rough-underline` の SVG `<filter>` を定義（[[theming-system]] §sketchy）。要素は `aria-hidden`。
- `<header id="app-header">`: タイトル / サブタイトル / `#header-user-name` / `#header-history-link` / `#new-consultation-button` / `.theme-buttons[data-theme]`
- 共通モーダル: `#summary-modal`（[[ui-summary]]）、`#resume-modal`（[[ui-resume]]）
- 画面コンテナ（`hidden` 切替）: `#onboarding-screen`（[[ui-onboarding]]）、`#history-screen`（[[ui-history]]）、`<main #chat-container>`
- チャット入力: `.mode-buttons[data-mode]`（default/empathy/solution）、`.category-buttons[data-category]`（仕事/人間関係/健康/日常生活/恋愛/お金）、`<textarea #message-input>`、`#char-count`、`#error-message`、`<button #send-button>`

## 関連

- [[client-main]] — `DOMContentLoaded` でこの DOM をフックして全モジュールを初期化
- [[frontend-style]] — `link rel="stylesheet" href="style.css"`
- [[theming-system]] — `<filter>` 定義の用途
- [[spa-architecture]]

## 出典

- `C:\ConsultationApplication\public\index.html:1-112`
