---
type: entity
sources:
  - C:\ConsultationApplication\src\routes\history.js
updated: 2026-04-26
tags: [routes, history, api]
---

# route-history

## 概要

履歴閲覧の Express ルータ。`createHistoryRouter(repo)`。`/api/history` 配下に2エンドポイント。

> **同名ファイル注意**: `history.js` という名前のファイルはプロジェクト内に2つある。本ページは API 側 `src/routes/history.js`。UI 側 `public/js/ui/history.js` は [[ui-history]] を参照。呼び出し関係は `[[ui-history]] → [[client-api]] (listHistory / getHistoryDetail) → route-history → [[db-repo]]`。

## エンドポイント

### `GET /api/history?uuid=...`

- 認証: ヘッダ または `?uuid=`。両方ある場合は **不一致で 403**（[[user-identification]] §クロスチェック）
- ユーザー存在チェック → 無ければ `404`
- `repo.listSessionsByUser` … 全セッション + 先頭 user 発言プレビュー
- プレビューは **50文字で切り詰め**（51文字以上なら `…` 付与）
- 成功: `200 { sessions: [{sessionId, startedAt, closedAt, preview}] }`

### `GET /api/history/:sessionId`

- 認証: ヘッダ（クエリ fallback なし）
- `repo.getSessionDetail` の戻りで分岐:
  - `null` → `404`
  - `{ forbidden: true }` → `403`
  - 正常 → `200 { session, messages, emotions }`

## 関連

- [[db-repo]] — `listSessionsByUser` / `getSessionDetail`
- [[db-table-sessions]] / [[db-table-messages]] / [[db-table-emotion-records]]
- [[user-identification]]
- 呼び出し元: [[client-api]] `listHistory` / `getHistoryDetail`、[[ui-history]]（一覧/詳細描画）
- [[analyses/client-vs-server-routing]] — `history.js` 同名ファイル問題を含む比較

## 出典

- `C:\ConsultationApplication\src\routes\history.js:16-83`
