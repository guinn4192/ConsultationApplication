---
name: ingest
description: ユーザーが「ingest <path>」「このファイルを取り込んで」「<path>をWikiに統合して」のように、C:\ConsultationApplication 配下のソースをCAWikiに取り込むように指示したときに起動する。.env等の禁止ファイルを安全に除外しつつ、関連するentity/concept/topicページを作成・更新し、双方向wikilinkとlog.mdエントリを維持する。
---

`C:\ConsultationApplication` 配下のソースを取り込んでCAWikiに統合する。

引数として取り込み対象のファイル/ディレクトリを受け取る（`C:\ConsultationApplication` からの相対パス、または絶対パス）。

## 手順

1. **対象パスの解決**
   - 相対パスなら `C:\ConsultationApplication\` を前置して絶対パス化する。
   - 絶対パスが `C:\ConsultationApplication\` の外なら中断し、ユーザーに確認する。

2. **読まないファイルの判定**（`CLAUDE.md` の表に従う）
   - `.env` / `.env.*` → **絶対に読まない**。即座にユーザーへ警告して中断する。
   - `node_modules/`, `.git/`, `.evaluator_tmp/`, `.playwright-mcp/`, `package-lock.json`, `*.db`, `*.db-wal`, `*.db-shm` → デフォルトでスキップ（明示要求時のみ読む）。
   - バイナリ（`*.png` など）→ 内容は読まず、存在のみ記録。

3. **既存Wikiとの照合**
   - `Grep` / `Glob` で既存ページを検索し、関連する `entities/` `concepts/` `topics/` を特定。

4. **ユーザーとの合意**
   - 主要な要点を3〜5行で提示し、どのページを新規作成 / 更新するかを伝える。
   - 大規模な変更（5ページ以上の更新）になる場合は確認を取る。

5. **ページの新規作成・更新**
   - フロントマター（`type` / `sources` / `updated` / `tags`）を必ず付ける。`updated` は **今日の日付**。
   - 双方向の wikilink を張る（リンクされる側のページにも追記する）。
   - 出典セクションに `C:\ConsultationApplication\...:行番号` を記載。

6. **`index.md` には触らない**
   - `index.md` の更新は本スキルの責務外。`update-index` スキルでのみ行う。

7. **ログ追記**
   - `log.md` に以下の形式で1エントリ追記:
     ```
     ## [<今日の日付>] ingest | <短い説明>
     - 対象: `<絶対パス>`
     - 触れたページ: [[page-1]], [[page-2]]
     - メモ: <任意>
     ```

## 注意

- 詳細仕様は `CLAUDE.md` を参照。本スキルはそれの実行手順。
- ページ規約・ファイル名・YAMLフロントマターは必ずスキーマに合わせる。
