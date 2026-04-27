# CAWiki Activity Log

ConsultationApplication向けLLM-Wikiの時系列ログ。append-onlyで保守する。各エントリは `## [YYYY-MM-DD] <kind> | <短い説明>` で始める。

種別: `init | ingest | query | lint | index`

---

## [2026-04-26] init | Wiki scaffolding を作成
- `CLAUDE.md`（スキーマ）、`log.md`、ディレクトリ構造（entities/, concepts/, topics/, analyses/）、スキル（ingest, query, lint, update-index — `.claude/skills/<name>/SKILL.md`）、サブエージェント（wiki-linter）を作成
- ソースルートは `C:\ConsultationApplication`
- 制約: `.env` は読まない / `sources/` は作らない / `index.md` は明示指示時のみ

## [2026-04-26] ingest | C:\ConsultationApplication\src ツリー全体
- 対象: `C:\ConsultationApplication\src\db\{driver,schema,repo}.js` および `C:\ConsultationApplication\src\routes\{user,sessions,emotions,history}.js`（計7ファイル）
- 触れたページ（新規 15 件）:
  - entities: [[db-driver]], [[db-schema]], [[db-repo]], [[route-user]], [[route-sessions]], [[route-emotions]], [[route-history]], [[db-table-users]], [[db-table-sessions]], [[db-table-messages]], [[db-table-emotion-records]]
  - concepts: [[user-identification]], [[session-lifecycle]], [[sqlite-driver-fallback]]
  - topics: [[data-model]]
- メモ:
  - `index.md` は更新していない（ユーザー指示なし）。
  - 本ingestでカバーしていない範囲: `C:\ConsultationApplication\server.js`（src/ の wiring）, `specs/`, `public/`。messages の書込側エンドポイントは src/routes/ に存在しないため [[db-table-messages]] で「未収録（SSE/チャットルート想定）」と注記済。
  - [[db-repo]] の `insertEmotion` 内で全件再取得しているのを軽微な非効率として記録（lint対象候補）。

## [2026-04-26] ingest | C:\ConsultationApplication\data ディレクトリ
- 対象: `C:\ConsultationApplication\data\.gitignore` のみテキスト読込。`app.db` / `app.db-shm` / `app.db-wal` は policy（`*.db*` はデフォルトスキップ）に従い **未読**。
- 触れたページ:
  - 新規: [[data-store]]
  - 既存更新（逆方向リンク追加）: [[db-driver]], [[db-schema]]
- メモ:
  - SQLite ランタイム成果物の所在・WAL/SHM の意味・git除外方針をWikiに記録。
  - 実DBスキーマの確認が必要になったら `sqlite3 app.db .schema` 等で取得し、[[db-schema]] と照合する流れを [[data-store]] に明記。

## [2026-04-26] ingest | C:\ConsultationApplication\public ツリー全体
- 対象: `index.html` / `style.css` / `js/{api,main,router,state}.js` / `js/ui/{chat,emotion,history,onboarding,resume,shared,summary}.js`（計13ファイル）。`app.js.sprint5.bak` はSprint 5の旧実装バックアップとして **未読**（必要なら別途 ingest）。
- 触れたページ（新規 18 件）:
  - entities: [[frontend-entry]], [[frontend-style]], [[client-state]], [[client-api]], [[client-router]], [[client-main]], [[ui-shared]], [[ui-chat]], [[ui-emotion]], [[ui-history]], [[ui-onboarding]], [[ui-resume]], [[ui-summary]]
  - concepts: [[consult-stream-protocol]], [[frontend-bootstrap]], [[emotion-trend-r6]], [[theming-system]]
  - topics: [[spa-architecture]]
- 触れたページ（既存更新、逆方向リンク追記）: [[user-identification]], [[session-lifecycle]], [[route-user]], [[route-sessions]], [[route-emotions]], [[route-history]]
- メモ:
  - **重大発見**: `POST /api/consult/stream`（SSE）は src/routes/ には存在しない。server.js または別ファイルが提供している想定。クライアント観点でのプロトコル仕様（イベント名、二重タイムアウト 60s/20s、フレーミング）を [[consult-stream-protocol]] に集約。
  - DESIGN.md R3（done 後にセレクタ描画）と R6（中盤 = floor(N/2)）を [[emotion-trend-r6]] にまとめ、複数モジュールに分散していた根拠を1か所に集約。
  - `index.md` は更新していない（ユーザー指示なし）。
  - 残カバー範囲候補: `C:\ConsultationApplication\server.js`（src/ + public/ の wiring + consult/stream の実体？）、`specs/`、ルートの `package.json`、各種スクリーンショット (`sketchy-*.png`)。

## [2026-04-26] query | apiFetch / handleJson の詳細解説
- 参照ページ: [[client-api]], [[user-identification]], [[consult-stream-protocol]], [[frontend-bootstrap]]
- filed-back: なし（新規 analysis ではなく、ユーザー指示で [[client-api]] §内部関数 を直接拡充）
- メモ:
  - `apiFetch` の3責務（ヘッダ正規化 / Content-Type 自動補完 / x-user-uuid 自動付与）を細分化、SSE が経由しない理由も明記。
  - `handleJson` のフロー図、204 正規化の理由、`err.status` の用途、`Content-Type` の貪欲チェックを追加。
  - `getUser` の 404 独自 throw を「軽微な冗長性 / lint候補」として記録。
  - `apiFetch` vs `consultStream` の比較は将来のanalysisページ候補（未作成）。

## [2026-04-26] query | client-main の「エントリ」とは何か
- 参照ページ: [[client-main]], [[frontend-entry]]
- 回答: 「エントリ」= エントリポイント（プログラム実行の起点）。SPA は HTML エントリ（[[frontend-entry]] = `public/index.html`）と JS エントリ（[[client-main]] = `public/js/main.js`）の2階層。
- 追記: [[client-main]] 概要に「エントリポイントである旨」と「2階層構造（HTML/JS）」を補足する一文を追加。

## [2026-04-26] query | フロントエンド用語（DOM / 配線 / 購読 / トースト）の意味
- 参照ページ: [[client-main]]
- 新規作成: [[frontend-glossary]]（汎用ウェブ用語の用語集。Obsidian の Page Preview コアプラグインによる **見出しリンクのホバープレビュー** で各用語の説明を即座に出せるよう、見出し単位で構成）
- 更新: [[client-main]] の該当 4 箇所（DOMContentLoaded / DOM ref / 配線 / 購読 / トースト）を `[[frontend-glossary#<term>|<表示名>]]` 形式に書き換え。「関連」セクションに [[frontend-glossary]] を追加。
- メモ: プロジェクト固有概念は従来通り `concepts/<name>.md` の独立ページで扱い、glossary は汎用ウェブ用語のみに絞る方針。

## [2026-04-26] migrate | C:\Obsidian\llm-wiki\CAWiki から C:\ConsultationApplication\wiki へ統合
- 全 35 ページ（entities 25 / concepts 8 / topics 2 / analyses 0）を `wiki/` 配下にコピー（書換不要、フロントマター `sources` は元から `C:\ConsultationApplication\<path>` の絶対パスで生きている）
- `.obsidian/`（vault 設定 5 ファイル）を `wiki/.obsidian/` に移植 — vault は `wiki/` 単位で運用
- skill 4 種（ingest, query, lint, update-index）と agent `wiki-linter` を `C:\ConsultationApplication\.claude\` 配下に統合
  - `query`, `lint`, `update-index`, `wiki-linter` の絶対パスを旧 `C:\Obsidian\llm-wiki\CAWiki` → 新 `C:\ConsultationApplication\wiki` に書換
  - `ingest` は元から旧パス参照なし、そのまま移植
- `wiki/CLAUDE.md` 新規（旧 CAWiki/CLAUDE.md からパス書換 + 配置・実装フロー責務分離の説明追記）
- ルート `C:\ConsultationApplication\CLAUDE.md` 末尾に「## ドキュメント Wiki」セクション追加（既存の Planner/Designer/Generator/Evaluator 定義は不変）
- `.claude/settings.local.json` に CAWiki 側の許可エントリ（`Bash(grep -E "^[^.].*\\.(md|txt)$")`）を追記
- 旧ディレクトリ `C:\Obsidian\llm-wiki\CAWiki\` は **未削除**（ユーザーが Obsidian で wiki/ vault を検証してから手動削除）

## [2026-04-26] query | history.js は何のためにあるのか
- 参照ページ: [[ui-history]], [[route-history]]
- メモ: `history.js` は2ファイル存在。`public/js/ui/history.js`（履歴閲覧UI、Feature 20）と `src/routes/history.js`（`/api/history` ルータ）。前者は気分推移3点表示と日付別一覧、後者はプレビュー50文字切り詰めと UUID クロスチェック認証を担う

## [2026-04-26] ingest | history.js 同名ファイル注記の追記
- 触れたページ: [[ui-history]], [[route-history]]
- メモ: 同名 `history.js` が UI 側 (`public/js/ui/history.js`) と API 側 (`src/routes/history.js`) の2箇所に存在することを両ページの概要直下に明示。呼び出し連鎖 `ui-history → client-api → route-history → db-repo` を両ページに記載。`ui-history` の「関連」に `[[route-history]]` の役割注記も追記

## [2026-04-28] query | client-routerのルーター/ルートとは何か
- 参照ページ: [[client-router]], [[frontend-glossary]], [[spa-architecture]], [[route-user]], [[route-sessions]], [[route-emotions]], [[route-history]]
- filed-back: [[analyses/client-vs-server-routing]]
- メモ: クライアント側ハッシュルータとサーバ側Express Router群の二系統を対比。双方向リンクを [[client-router]] / [[spa-architecture]] / [[route-history]] に張り戻し。
