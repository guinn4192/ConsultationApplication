# CAWiki — ConsultationApplication LLM-Wiki

このディレクトリは `C:\ConsultationApplication` の **コードベース・仕様・データ構造を継続的にドキュメント化する LLM-Wiki** である。Wikiは本ディレクトリ配下のmarkdownファイル群として、Claudeがインクリメンタルに構築・保守する。

ユーザーはソースの選定・質問・方向付けを行い、Claudeは要約・横断参照・整合性維持などの「面倒なメンテナンス」を担う。`llm-wiki.md` がパターンの原典なので、迷ったらそれを参照する。

> **配置**: 本Wikiは `C:\ConsultationApplication\wiki\` にあり、ソースの `C:\ConsultationApplication\` と同一プロジェクト配下に統合されている。skill / agent 定義は `C:\ConsultationApplication\.claude\` 配下に置かれており、プロジェクトルートで Claude Code を起動すれば `/ingest`, `/query`, `/lint`, `/update-index` がそのまま使える。

---

## ソース・ルート（重要）

- **ソースの正準位置**: `C:\ConsultationApplication`
- Wikiディレクトリ内には **生のソースをコピーしない**。Wikiが保持するのは「LLMが書いたmarkdownページ」だけ。
- このプロジェクトには `sources/` フォルダは存在しない。`raw/` も作らない。**作成しないこと**。

### 読まないファイル（必ず守る）

| パス/種別 | 理由 |
| --- | --- |
| `**/.env`, `**/.env.*` | 機密情報。たとえユーザーから明示的に指示されても読まない |
| `**/node_modules/**` | 依存パッケージ。明示要求がない限りスキップ |
| `**/.git/**` | Gitメタデータ |
| `**/.evaluator_tmp/**`, `**/.playwright-mcp/**` | 一時ファイル |
| `package-lock.json` | 自動生成。明示要求時のみ |
| バイナリ（`*.png`, `*.db`, `*.db-wal`, `*.db-shm`等） | 存在を記録するが内容は読まない（必要な場合は画像表示で確認） |

`.env` を読まないのは絶対のルールである。`grep` や `Read` で誤って触れた場合、即座に中断し内容をWikiに転記してはならない。

---

## ディレクトリ構造

```
C:\ConsultationApplication\wiki\
├── CLAUDE.md              # 本ファイル（Wikiスキーマ）
├── llm-wiki.md            # 原典のアイデア文書（編集しない）
├── log.md                 # 時系列の活動ログ（append-only）
├── index.md               # ※明示指示時のみ作成・更新（普段は触らない）
├── entities/              # 個別の対象物：モジュール、ファイル、ルート、DBテーブル、エンドポイント、機能
├── concepts/              # 抽象概念：設計パターン、規約、データフロー、セキュリティモデル
├── topics/                # 合成ページ：複数のentity/conceptをまたぐテーマ（例：認証フロー、相談ワークフロー）
├── analyses/              # filed-back クエリ：比較・深堀り・調査メモ
└── .obsidian/             # Obsidian vault 設定（wiki/ を vault として開く）
```

skill / agent 定義は本ディレクトリではなく **プロジェクト直下** にある:

```
C:\ConsultationApplication\.claude\
├── skills\                # /ingest, /query, /lint, /update-index
└── agents\                # wiki-linter（lint スキルから委譲される）
                            # ※ planner/designer/generator/evaluator は実装フロー側のエージェント
```

ディレクトリは必要に応じて拡張してよいが、追加した場合は本ファイルに必ず反映すること。

---

## ページ規約

### ファイル名
- `kebab-case.md`（例: `consultation-route.md`, `auth-flow.md`）
- 1ページ = 1つの主題。曖昧になったら分割する。

### YAMLフロントマター（必須）

```yaml
---
type: entity | concept | topic | analysis
sources:
  - C:\ConsultationApplication\path\to\file.js
  - C:\ConsultationApplication\specs\SPEC.md
updated: 2026-04-26
tags: [routes, auth, db, ...]
---
```

- `sources` はWikiの根拠となった `C:\ConsultationApplication` 配下のファイル絶対パス。
- `updated` は最終編集日（ISO 8601）。
- `tags` はObsidianのタグ機能と互換（任意）。

### 本文構造（推奨）

```markdown
# <ページタイトル>

## 概要
（1〜3行の要約）

## 詳細
（必要に応じてセクション分割）

## 関連
- [[other-page]] — どう関係するか
- [[another-page]]

## 出典
- `C:\ConsultationApplication\src\routes\foo.js:42-88`
- `C:\ConsultationApplication\specs\SPEC.md` §3
```

### リンク
- ページ間リンクは Obsidian wikilink: `[[page-name]]`
- 外部リソースは通常のmarkdownリンク
- ソースコードへの参照は **絶対パス + 行番号** を可能な限り付ける（例: `src/server.js:120`）

---

## 運用フロー

各操作は `C:\ConsultationApplication\.claude\skills\<name>\SKILL.md` に詳細手順がある。Skillツールから起動するか、ユーザーが `/<name>` でスキル名を呼ぶことで実行される。

### Ingest（取り込み）— skill: `ingest`

ユーザーが「ingest <path>」「このファイルを取り込んで」等を指示した場合:

1. 対象を `C:\ConsultationApplication` 配下から `Read` する。
   - 「読まないファイル」表に該当する場合は中断してユーザーに伝える。
2. 既存Wikiを `Grep` / `Glob` し、関連ページを特定する。
3. 主要な要点をユーザーに短く提示し、合意を取る（必要に応じて）。
4. 該当する `entities/` `concepts/` `topics/` ページを **新規作成または更新** する。
   - 双方向のwikilinkを必ず張る（リンクされる側のページにも追記）。
   - フロントマター `sources` / `updated` を必ず更新。
5. **`index.md` は触らない**（明示指示があった場合のみ別途 `/update-index` を実行）。
6. `log.md` に1エントリ追記する（後述フォーマット）。

### Query（質問応答）— skill: `query`

ユーザーがWikiに対して質問してきた場合:

1. `Grep` / `Glob` でWiki内を検索。
2. `index.md` が存在すれば参照する（無くてもよい）。
3. 関連ページを `Read` し、合成して答える。回答には:
   - Wikiページへの wikilink
   - 出典ソースファイルの絶対パス + 行番号
4. 回答が **新しい合成・比較・深堀り** を含む場合、`analyses/` への filing back を提案する（自動では作らず、ユーザーの同意を得てから）。
5. `log.md` に query エントリを追記。

### Lint（健康診断）— skill: `lint`

ユーザーが「lint」「健康診断」等を指示した場合:

`C:\ConsultationApplication\.claude\agents\wiki-linter.md` のサブエージェントに委譲することを優先する。サブエージェントは以下を検出する:

- ページ間の矛盾
- 古い記述（より新しいソースで上書きされている）
- orphan ページ（誰からもリンクされていない）
- 言及はあるが独立ページが無い概念
- 不足している横断参照
- Web検索で埋められそうなデータギャップ

レポートのみを返す。修正は **ユーザーの指示を受けてから** 行う。完了後 `log.md` にエントリを追記。

### Index 更新（明示指示時のみ）— skill: `update-index`

`index.md` は **自動メンテしない**。`ingest` や `query` の中で更新してはならない。

ユーザーから明示的に指示があった場合のみ `update-index` スキルを実行する。手順は `C:\ConsultationApplication\.claude\skills\update-index\SKILL.md` 参照。

---

## ログ・フォーマット

`log.md` は append-only。以下の形式で先頭が `## [` で始まるようにする（`grep "^## \[" log.md | tail -5` でテール取得可能）。

```markdown
## [2026-04-26] ingest | <短い説明>
- 対象: `C:\ConsultationApplication\src\routes\foo.js`
- 触れたページ: [[foo-route]], [[routing-overview]]
- メモ: <任意>

## [2026-04-26] query | <質問の短い表現>
- 参照ページ: [[auth-flow]], [[user-entity]]
- filed-back: [[analyses/auth-vs-session-comparison]]（あれば）

## [2026-04-26] lint | full pass
- 検出: orphan 2件、矛盾 0件、概念ギャップ 3件
- レポート: 本文末尾参照 / 別途要約

## [2026-04-26] index | rebuild on user request
- 全 N ページをカテゴリ別に再構成
```

種別は `ingest | query | lint | index | init | migrate` のいずれか。日付は **必ず実際の今日の日付**（実行時の `currentDate` を使う）。

---

## 制約とカスタマイズの要点（再掲）

ユーザーから受けたカスタマイズで、特に外してはならない点:

1. **ソースは `C:\ConsultationApplication` から読む**。Wiki配下に `sources/` を作らない。生ファイルを複製しない。
2. **`.env` は絶対に読まない**（明示指示があってもスキップし、ユーザーに警告）。
3. **`index.md` は明示指示時のみ作成・更新**。`/ingest` や通常の編集では触らない。
4. **実装フローとの責務分離**: 本Wiki系のスキル/エージェント（ingest/query/lint/update-index/wiki-linter）は **ドキュメント側**。プロジェクトルート `CLAUDE.md` で定義された Planner/Designer/Generator/Evaluator は **実装フロー側**。互いのファイル群（specs/, wiki/）を上書きしない。

これらに反する操作は実行前に必ずユーザーに確認する。

---

## 補足

- ObsidianのGraph view、Dataview（フロントマターtag/typeで集計可能）、Marpなどは利用可能。Wikiは普通のmarkdownなので追加ツールに依存しない。
- Obsidian で本ディレクトリ（`C:\ConsultationApplication\wiki\`）を vault として開く運用。`.obsidian/` が vault 設定（appearance, graph, workspace 等）を保持する。
- 規模が大きくなり `index.md` だけでは検索が辛くなったら `qmd` 等の導入を検討する（その時点で本ファイルを更新）。
- 本ファイル自体もユーザーとの協働で進化させる。運用上の発見はここに反映する。
