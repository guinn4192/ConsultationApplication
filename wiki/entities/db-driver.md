---
type: entity
sources:
  - C:\ConsultationApplication\src\db\driver.js
updated: 2026-04-26
tags: [db, driver, sqlite]
---

# db-driver

## 概要

SQLite ドライバの薄い抽象化レイヤ。`openDb(filePath)` を公開し、上位層（[[db-schema]] / [[db-repo]]）が **どの SQLite 実装を使っているかを意識せずに済む** 共通インタフェースを返す。

## 公開インタフェース

`openDb(filePath)` は以下のオブジェクトを返す。

```js
{
  impl: "better-sqlite3" | "node:sqlite",
  exec(sql),                     // 複数ステートメント一括実行
  prepare(sql).run(...params),   // INSERT/UPDATE/DELETE
  prepare(sql).get(...params),   // 単行 SELECT
  prepare(sql).all(...params),   // 複数行 SELECT
  pragma(s),                     // PRAGMA
  close(),
  raw                            // 元の DB ハンドル
}
```

ファイルパスのディレクトリは自動作成される（`fs.mkdirSync({ recursive: true })`）。

## 実装の二重化

[[sqlite-driver-fallback]] 参照。要点:

1. まず `better-sqlite3` を `require` する。Windows で Visual Studio が無いとネイティブビルドが失敗するので失敗時は次へ。
2. 次に Node 22+ の組込 `node:sqlite`（`DatabaseSync`）を試す。`ExperimentalWarning` の SQLite 警告は読込時に限定的に抑制する（`process.emitWarning` を一時差し替え）。
3. 両方失敗したら、両方のエラーメッセージを連結して `throw`。`e.cause` に最後のエラーを付与。

## API 互換性のための対応

- `node:sqlite` には `pragma()` メソッドが無いので、内部で `exec("PRAGMA ${s};")` に変換し戻り値を `null` に統一する。
- `node:sqlite` の `StatementSync.run()` は Node v22 以降で `{ changes, lastInsertRowid }` を返すので追加変換は不要。

## 関連

- [[db-schema]] — 起動時に `db.exec` / `db.pragma` / `db.prepare` を使ってテーブル作成と orphan close を行う
- [[db-repo]] — すべてのCRUDが本ドライバの prepared statement に依存
- [[sqlite-driver-fallback]] — フォールバックパターンの背景
- [[data-store]] — `openDb(filePath)` が開く物理ファイルの所在

## 出典

- `C:\ConsultationApplication\src\db\driver.js:14-121`
- DESIGN.md §1.1（参照）
