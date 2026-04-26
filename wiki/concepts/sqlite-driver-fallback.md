---
type: concept
sources:
  - C:\ConsultationApplication\src\db\driver.js
updated: 2026-04-26
tags: [db, driver, portability]
---

# sqlite-driver-fallback

## 概要

[[db-driver]] が採用している「2段フォールバック」パターン。優先 → 代替 → 失敗の3経路を1関数 (`openDb`) に閉じ込めて、上位層は実装を意識しない。

## なぜ必要か

- **第1候補**: `better-sqlite3`。プロダクション用途で広く使われる同期API。
- **問題**: Windows 環境で **Visual Studio (C++ build tools) が無いとネイティブビルドが失敗** する。手元でセットアップする開発者にとってインストール障壁。
- **第2候補**: Node 22+ 同梱の `node:sqlite`（`DatabaseSync`）。ビルド不要だが ExperimentalWarning が出る。

## 実装上のポイント

1. **try/catch で順に require**。最初の例外は `betterErr` に保持し、両方失敗時のメッセージに連結する。
2. **`ExperimentalWarning` の局所的な抑制** — `process.emitWarning` を一時差し替えて `node:sqlite` ロード時のみ抑制し、`finally` で必ず復元する。グローバルに警告を黙らせない（他の警告に影響しないため）。
3. **APIシム**: better-sqlite3 のメソッド名と引数を「正」とする。
   - `pragma()` … node:sqlite には存在しないので `exec("PRAGMA ${s};")` に書き換え、戻り値は `null` 固定。
   - `prepare().run()` … node:sqlite v22+ では既に `{ changes, lastInsertRowid }` を返すので追加変換不要。
   - `prepare().get/all()` … API一致。

## 適用上の注意

- 上位（[[db-schema]] / [[db-repo]]）は `pragma()` の戻り値を **見てはいけない**（実装間で異なる）。本リポジトリでは利用していない。
- `impl` フィールドで実行時にどちらが選ばれたか判定可能。ログ出力に使える。
- 両方失敗時は **両方のエラーメッセージを連結した `Error`** を投げ、`e.cause` に最後のエラーを格納する。診断のため両情報を残すのが目的。

## 関連

- [[db-driver]] — 実装
- [[db-schema]] — 利用側の代表例（`exec` / `pragma` / `prepare`）

## 出典

- `C:\ConsultationApplication\src\db\driver.js:38-118`
