---
type: concept
sources:
  - C:\ConsultationApplication\public\js\main.js
  - C:\ConsultationApplication\public\index.html
updated: 2026-04-26
tags: [frontend, glossary, terminology]
---

# frontend-glossary

## 概要

CAWiki のフロントエンド系ページで頻出する **汎用ウェブ用語の用語集**。プロジェクト固有の概念（[[user-identification]]、[[session-lifecycle]] など）はそれぞれ独立ページで扱う。本ページは「ブラウザ・JS 一般の語彙で、ホバープレビューでサッと意味が確認できると便利なもの」だけを集める。

各エントリは **見出し単位** で書き、参照側は `[[frontend-glossary#<term>|<表示名>]]` の形式でリンクする。Obsidian の **Page Preview コアプラグイン** が見出しリンクのホバー時にそのセクションだけをポップアップ表示する仕様を活用するため。

---

## DOM

**Document Object Model**。ブラウザが HTML をパースして作る、ドキュメントのツリー構造のオブジェクト表現。JS から `document.getElementById(...)` / `querySelector(...)` で触る対象。

`DOMContentLoaded` イベントは **HTML がパースされ DOM ツリーが完成した瞬間** に発火する。画像など外部リソースのロードは待たない（`load` イベントより早い）。SPA のブートストラップは通常このタイミングで走る（cf. [[client-main]] §初期化）。

## 配線 (wiring)

部品同士を結びつけて動く状態にする作業の **比喩**（電気配線が由来）。ソフトウェアでは、各モジュールに必要な依存（DOM 参照・コールバック・他モジュールへのハンドル）を渡し、内部でイベントハンドラを取り付けて動作可能にすることを指す。

[[client-main]] では各 UI モジュールの `init*(deps, callbacks)` 関数を呼ぶことで配線を行う。**依存性注入 (DI)** に近い概念。

## 購読 (subscribe)

**Pub-Sub / Observer パターン** の用語。「あるイベント・状態変化が起きたら、登録したコールバックを呼んでほしい」と申し込むこと。発火側が直接呼び出し先を知らずに済むため、疎結合になる。

例:
- `state.onEmotionRecorded(cb)` — 感情記録イベントを購読（[[client-state]]）
- `subscribeRoute(route => ...)` — ルート変化を購読（[[client-router]]）

## トースト (toast)

画面の隅に **短時間表示されて自動で消えるポップアップ通知** の UI パターン。トースターから食パンが「ポン！」と飛び出すイメージが語源。モーダルと違ってユーザーの操作を要求せず邪魔にならない。

[[client-main]] の `showPersistError(msg)` は `#persist-error-toast` を `position: fixed` で画面に挿入し、`role="alert"` / `aria-live="polite"` を付けて 4 秒で fade out するトースト実装。

## 関連

- [[client-main]] — 上記用語の主な使用箇所
- [[frontend-entry]] — DOM の供給源（HTML エントリ）
- [[client-state]] / [[client-router]] — 購読の対象になるイベント源

## 出典

- `C:\ConsultationApplication\public\js\main.js:1-440`
- `C:\ConsultationApplication\public\index.html:1-112`
