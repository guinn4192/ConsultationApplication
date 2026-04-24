# Sprint 7 実装（DB永続化 + オンボーディング + 履歴 + 会話再開）

**日付**: 2026-04-22
**関連スプリント**: Sprint 7（Feature 18/19/20/21）

## やったこと

### Generator サブエージェント起動 → Sprint 7 一括実装

Sprint 6 評価合格を受け、Generator サブエージェントを foreground で起動。約 25 分で全 4 機能を実装完了（自己評価 A）。

#### 実装した Feature

| Feature | 内容 |
|---|---|
| 18 | 匿名ユーザー識別 + オンボーディング画面（UUID サーバ発行 / localStorage 永続化 / ヘッダ表示） |
| 19 | 相談・気分データの DB 永続化（users/sessions/messages/emotion_records 4 テーブル + 3 インデックス、SSE 前後で INSERT、冪等 close） |
| 20 | 過去の相談履歴閲覧画面（閲覧専用、日付グルーピング、気分推移トラック） |
| 21 | 中断した会話の再開モーダル（同日未 close 検知、ストリーミングなし即時復元） |

#### 新規ファイル

- `src/db/driver.js` / `schema.js` / `repo.js`（DB 抽象化、prepared statement、orphan close）
- `src/routes/user.js` / `sessions.js` / `emotions.js` / `history.js`（Express ルーター分割）
- `public/js/router.js`（hash ベース SPA ルーター）
- `public/js/ui/onboarding.js` / `history.js` / `resume.js`（新画面 UI）
- `data/.gitignore`（DB ファイル除外）

#### 主要更新

- `server.js`: DB 初期化 + ルート登録 + `/api/consult/stream` の INSERT 組み込み
- `public/index.html`: header-user-row / onboarding-screen / history-screen / resume-modal 追加
- `public/js/state.js`: `userName` / `setSessionId` / `replaceAssistantMessageId` / `restoreFromServer` 追加
- `public/js/api.js`: `apiFetch` + `x-user-uuid` 自動付与、新規エンドポイント関数群
- `public/js/main.js`: bootstrap 4 段階フロー + router 購読 + emotion listener で `saveEmotion`
- `public/style.css`: Sprint 7 スタイル追記（モバイル対応含む）
- `package.json`: `start` に `--no-warnings=ExperimentalWarning`、`better-sqlite3` を `optionalDependencies` へ

### スモークテスト

`npm start` 起動 → API エンドポイント全て手動確認（curl 相当）:
- `POST /api/user/register` → 201 + `{uuid, userName}`
- `POST /api/sessions` → 201 + `{sessionId, startedAt}`
- `GET /api/sessions/resumable?uuid=...` → 200 + 復元 payload（同日 open session 検知）
- `GET /api/history?uuid=...` → 200 + sessions 一覧

### コミット

実装完了直後に `git commit -m "永続化実装"` (`bac45f9`)。

## 決めたこと

### better-sqlite3 のフォールバック

- **症状**: Windows 11 + Node v24 環境で `npm install better-sqlite3` が **ネイティブビルド失敗**（Visual Studio Build Tools 未導入 / Node v24 向けプリビルド未配布）
- **対応**: DESIGN §1.1 が許可する **`node:sqlite`（Node 22+ builtin）へのフォールバック**を `src/db/driver.js` に実装。両者を try/catch で自動選択
- **package.json**: `better-sqlite3` を `optionalDependencies` に移動（インストール失敗を許容）
- **起動ログ**: `DB initialized: data/app.db (driver: node:sqlite, WAL)` でフォールバック発動を可視化

### state 接続点の整理（Sprint 6 → 7 の移行）

- `state.sessionId` は Sprint 6 でクライアント `crypto.randomUUID()` 採番済み → Sprint 7 で DB PK にそのまま流用
- `state.recordEmotion` を Sprint 7 で `POST /api/emotions` 発火に拡張（fire-and-forget + トースト）
- `event: done` の data に `assistantMessageId` を含めてサーバ採番 ID を返す → クライアント側で `state.replaceAssistantMessageId(oldId, newId)` で差し替え

### `/api/consult/stream` 後方互換維持

- Sprint 6 のクライアントがそのまま動くよう、`sessionId` / `userUuid` が body に含まれていなくても 400 にしない
- これらが含まれる場合のみ DB INSERT を行う設計
- `event: done` の data に `persisted: boolean` を含め、DB 書込結果をクライアントに通知 → 失敗時はトースト表示

## ハマったこと / 解決

### better-sqlite3 ビルド失敗

- **症状**: `npm install better-sqlite3` が gyp エラーで停止
- **原因**: Windows 11 + Node v24 ではプリビルドバイナリ未配布、ソースビルドには Visual Studio Build Tools が必要
- **解決**: 設計時に許可されていた `node:sqlite` フォールバック経路に切替。driver.js で透過的に処理するため上位コードへの影響ゼロ

### `/api/consult/stream` の前方互換テスト

- **問題**: Sprint 6 で動いていた挙動を Sprint 7 で壊さないか不安だった
- **対応**: スモーク中に旧形式 body（`sessionId` / `userUuid` なし）でも 200 ストリーミング応答することを `node:fetch` で確認
- **結果**: 既存挙動は完全保持。INSERT は `userUuid && sessionId` ガード付き

## 変更ファイル

新規 12 ファイル、更新 7 ファイル。詳細は上記「新規ファイル」「主要更新」参照。

`public/app.js` は Sprint 6 で `public/app.js.sprint5.bak` にリネーム済み、Sprint 7 でも未削除のまま保全。

## 次やること

- Evaluator サブエージェントで Sprint 7 合否判定（Playwright MCP 利用）
- 合格なら本機能リリース判断へ
- 不合格なら Generator に修正依頼
