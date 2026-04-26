---
type: entity
sources:
  - C:\ConsultationApplication\data\.gitignore
  - C:\ConsultationApplication\data\app.db
  - C:\ConsultationApplication\data\app.db-shm
  - C:\ConsultationApplication\data\app.db-wal
updated: 2026-04-26
tags: [db, sqlite, storage, ops]
---

# data-store

## 概要

SQLite の物理データ格納ディレクトリ。`C:\ConsultationApplication\data\` 配下にランタイム成果物が置かれる。アプリ起動時に [[db-driver]] の `openDb(filePath)` がここのファイルを開き、必要ならディレクトリを自動作成する（`fs.mkdirSync({ recursive: true })`）。

> **注**: 本ページは `data/` の **役割・構成・運用方針** をWikiに残す目的のもの。`*.db` 等のバイナリは取り込みポリシー上「明示要求時のみ読む」対象なので、本ingestでは内容を読み取っていない。スキーマの定義は [[db-schema]] と各 `db-table-*` ページが正準。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `app.db` | メインのデータベースファイル |
| `app.db-wal` | Write-Ahead Log。`journal_mode = WAL`（[[db-schema]] §PRAGMA）のための副産物 |
| `app.db-shm` | WAL 用の Shared Memory ファイル |
| `.gitignore` | SQLite 成果物を git 管理から除外（DESIGN.md §2.3 / R5） |

`.gitignore` の除外パターン:

```
*.db
*.db-journal
*.db-wal
*.db-shm
*.sqlite
*.sqlite-journal
```

## 運用上の注意

- **WAL ファイルは「サイズが大きい = 異常」ではない**。`PRAGMA wal_checkpoint` または DB クローズ時に main へ反映される。本リポジトリでは明示的なチェックポイント呼び出しは無く、SQLite のデフォルトに任せている。
- **3 ファイルは1 セット**。バックアップや手動コピー時は WAL/SHM も同時に扱うか、事前に `PRAGMA wal_checkpoint(TRUNCATE)` を実行して main へ集約する。
- WAL モードはクラッシュ耐性を上げる代わりに同一プロセス前提で扱うのが安全（複数プロセスからの同時オープンは別途検討）。

## DB の中身を確認したいとき

policy 上、Claude は `*.db*` バイナリを **デフォルトでは読まない**。次のどちらかで明示的に許可された時のみ参照する:

1. ユーザーが `ingest data/app.db` のように **直接ファイル名を指定** して取り込みを依頼した場合
2. `/query` 中に「実際の DB の状態を見せて」等の明示要求があった場合

どちらの場合も、生バイナリを `Read` で開くのではなく、`sqlite3` CLI 等で `.schema` や `SELECT` をサンプリングしてWikiへ反映する想定。

## 関連

- [[db-driver]] — このディレクトリを開く側
- [[db-schema]] — スキーマ定義（WAL の根拠もここ）
- [[data-model]] — テーブル関係の俯瞰

## 出典

- `C:\ConsultationApplication\data\.gitignore:1-7`
- `C:\ConsultationApplication\src\db\driver.js:32-36`（ディレクトリ自動作成）
- `C:\ConsultationApplication\src\db\schema.js:58-60`（`journal_mode = WAL`）
