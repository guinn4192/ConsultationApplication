---
type: analysis
sources:
  - C:\ConsultationApplication\public\js\router.js
  - C:\ConsultationApplication\public\js\main.js
  - C:\ConsultationApplication\src\routes\user.js
  - C:\ConsultationApplication\src\routes\sessions.js
  - C:\ConsultationApplication\src\routes\emotions.js
  - C:\ConsultationApplication\src\routes\history.js
  - C:\ConsultationApplication\src\server.js
updated: 2026-04-28
tags: [routing, frontend, backend, comparison]
---

# client-vs-server-routing

## 概要

ConsultationApplication には「ルーター」と「ルート」と呼ばれるものが **2系統** ある:

1. **クライアント側**: ハッシュベースの SPA ルータ（[[client-router]]）— ブラウザ内で URL の `#/...` 部分と画面の対応を管理
2. **サーバ側**: Express の Router を使った API ルータ群（[[route-user]] / [[route-sessions]] / [[route-emotions]] / [[route-history]]）— HTTP リクエストパスと handler の対応を管理

両者は **別物で、直接マップしない**。フロントの画面遷移とサーバの API 応答は独立したレイヤで起きる。本ページは混同を避けるために両者を並べて比較する。

## 用語の最小定義

| 用語 | 意味 |
| --- | --- |
| **ルート (route)** | 1個の URL/パスパターンと、それに対応する処理のマッピング |
| **ルーター (router)** | 複数のルートをまとめ、入力（hash 変化 / HTTP リクエスト）から正しいルートに振り分けるディスパッチャ |

## 並列比較

| 軸 | クライアント側 | サーバ側 |
| --- | --- | --- |
| 実装ファイル | `public/js/router.js` | `src/routes/user.js` / `sessions.js` / `emotions.js` / `history.js` |
| Wikiページ | [[client-router]] | [[route-user]] / [[route-sessions]] / [[route-emotions]] / [[route-history]] |
| ルートの形 | `{name, path, params}` オブジェクト | HTTP メソッド + パス（`POST /api/sessions/:id/close` など） |
| 入力イベント | `window.hashchange` | HTTP リクエスト |
| マッチング対象 | `location.hash`（`#/history/:id` など） | `req.method` + `req.path` |
| ディスパッチ機構 | 自前の `_listeners: Set` への emit | Express Router |
| マウント | モジュール読込時に `addEventListener` を1回 | `server.js` で `app.use("/api/xxx", router)` |
| 定義数 | 4ルート（`root` / `onboarding` / `history` / `historyDetail`） | 計8エンドポイント（user 2 / sessions 3 / emotions 1 / history 2） |
| パラメータ取得 | `parseHash()` が `params.sessionId` を抽出 | Express の `req.params.id` / `req.query.uuid` |
| 認証 | （クライアントは認証しない） | [[user-identification]] のヘッダ規約（`x-user-uuid`）。ただし [[route-user]] は例外で適用外 |
| 副作用 | 画面切替（[[client-main]] の `performNavigate`） | DB 読み書き（[[db-repo]] 経由） |
| 不正入力時 | `(unknown)` ルート → `navigate(ROOT)` でフォールバック | `400` / `403` / `404` を HTTP で返す |

## 相互の関係

両者は **独立** だが、ユーザー操作の流れの中で連動する。例えば履歴閲覧:

1. ユーザーがリンクをクリック → `location.hash = "#/history"` に変わる
2. **クライアントルータ** が `hashchange` を受けて `{name:"history"}` を emit
3. [[client-main]] の購読者が画面を切り替え、[[ui-history]] が描画開始
4. [[ui-history]] が [[client-api]] の `listHistory` を呼ぶ → `GET /api/history?uuid=...`
5. **サーバルータ** [[route-history]] が `repo.listSessionsByUser` を呼んで JSON を返す

つまり 1〜3 がクライアントルーティング、4〜5 がサーバルーティング。**同じ「history」という語でも別レイヤ**である。

## 同名ファイルの注意

`history.js` という名前のファイルは2つある:

- `public/js/ui/history.js` → [[ui-history]]（履歴画面の UI モジュール）
- `src/routes/history.js` → [[route-history]]（履歴 API のサーバルータ）

呼び出し関係は `[[ui-history]] → [[client-api]] (listHistory / getHistoryDetail) → [[route-history]] → [[db-repo]]`。

## 画面 ⇄ ルート ⇄ UI モジュール ⇄ API の対応

[[spa-architecture]] §「画面 ⇄ ルート ⇄ UI モジュール ⇄ API ⇄ DB」表からの抜粋:

| 画面 | クライアントルート | UI モジュール | サーバルート（主要） |
| --- | --- | --- | --- |
| 相談 | `#/` | [[ui-shared]] / [[ui-chat]] / [[ui-emotion]] / [[ui-summary]] | `POST /api/sessions` / `POST /api/sessions/:id/close` / `POST /api/emotions` / `POST /api/consult/stream` |
| オンボ | `#/onboarding` | [[ui-onboarding]] | `POST /api/user/register` |
| 履歴一覧 | `#/history` | [[ui-history]] | `GET /api/history?uuid=` |
| 履歴詳細 | `#/history/:id` | [[ui-history]] | `GET /api/history/:sessionId` |
| 起動時 F21 | （ROOT に重畳） | [[ui-resume]] | `GET /api/sessions/resumable` / `POST /api/sessions/:id/close` |

## 設計上の特徴

- クライアントルータは **ハッシュベース**（`#/...`）。HTML5 History API（`pushState`）ではないので、サーバ側のフォールバック（`*` → `index.html`）が不要。これにより [[spa-architecture]] のビルドレス Vanilla ESM 構成と相性がよい。
- サーバルータは **責務ごとに4ファイルに分割**（user / sessions / emotions / history）。各々が `createXxxRouter(repo)` 形式の **ファクトリ関数** を export し、`server.js` で repo を注入してマウントする（依存性注入の発想）。
- `POST /api/consult/stream` は4つの `route-*` ファイルには **存在せず**、`server.js` または別ファイル（未取り込み）が提供する想定（[[consult-stream-protocol]] §概要）。

## 関連

- [[client-router]] — クライアント側ルータの本体ページ
- [[route-user]] / [[route-sessions]] / [[route-emotions]] / [[route-history]] — サーバ側ルータ群
- [[spa-architecture]] — 全体俯瞰、対応表の出典
- [[client-main]] — クライアントルータの唯一の購読者
- [[client-api]] — フロントから API を一手に叩く窓口
- [[user-identification]] — サーバルータ群が共有する認証規約
- [[frontend-glossary#購読 (subscribe)|購読]] — クライアントルータが Pub-Sub の発火側になる用法

## 出典

- `C:\ConsultationApplication\public\js\router.js:1-89`
- `C:\ConsultationApplication\public\js\main.js:1-440`
- `C:\ConsultationApplication\src\routes\user.js:12-66`
- `C:\ConsultationApplication\src\routes\sessions.js:22-110`
- `C:\ConsultationApplication\src\routes\emotions.js:15-63`
- `C:\ConsultationApplication\src\routes\history.js:16-83`
