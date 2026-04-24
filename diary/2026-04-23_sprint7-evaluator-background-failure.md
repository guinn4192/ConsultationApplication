# Sprint 7 Evaluator バックグラウンド起動による全停止失敗

**日付**: 2026-04-23
**関連スプリント**: Sprint 7（評価フェーズ）

## やったこと

### Sprint 7 Evaluator サブエージェントを **バックグラウンド** で起動

Sprint 7 実装が完了しているので Evaluator にテスト依頼。私（Claude）の判断ミスで `run_in_background: true` を指定して Agent ツールを呼んだ。長時間（30 分以上）かかる見込みだったため、ユーザーを待たせず会話できるようにと考えての選択。

### 早々にユーザーが中断

実行開始から数分で、ユーザーから「いったん中断して。何に時間がかかってる？」の指示。

実行状態を確認しようとしたら通知が届き、Evaluator が約 33 分後に**レポートゼロで停止完了**していた。

### 失敗内容の確認

サブエージェントの最終報告:

- **Bash 権限プロンプトが大量に拒否されていた**: `ls -la`, `npm start`, `Get-Process node`, `data/app.db*` 退避コマンドなど、allowlist 未登録の操作が全て denied 扱い
- **Playwright MCP ツールが attach されていなかった**: `mcp__playwright__browser_*` が一切使えず、UI 操作テスト不可
- 静的解析（ファイル読み込み）だけ実施して終了

### 続けて、ユーザーが NG時の方針も変更

「NG でも、やっぱりいったん実装には戻らなくていい」とのことで、不合格なら自動で Generator にリトライさせる運用は撤回。

## 決めたこと

### Evaluator サブエージェントは **常に foreground 起動**

メモリにフィードバックとして保存（`feedback_evaluator-foreground.md`）:

- **Why**: バックグラウンドだと Bash 権限プロンプトに人間が応答できず自動拒否、Playwright MCP の attach タイミングも噛み合わない可能性
- **How to apply**: Evaluator 起動時は `run_in_background` を指定しない。「結果を待って次の判断（合否）に進む必要がある」のは定義上 foreground 案件
- 一般化: subagent の出力を次のステップの入力に使う場合は全て foreground

### 「並行で他の作業をする」実態がないなら background は使わない

Agent ツールのドキュメント:
> Use foreground (default) when you need the agent's results before you can proceed.
> Use background when you have genuinely independent work to do in parallel.

Evaluator は前者に該当する。「ユーザーを待たせない」だけを理由にした background 化は誤判断。

## ハマったこと / 解決

### Bash 権限の連打拒否がなぜ起きたか

- **誤推測（最初）**: deny リストに登録されているコマンドを叩こうとしたから
- **実態**:
  - `~/.claude/settings.json` も `.claude/settings.local.json` も deny リストはほぼ空
  - 仕組みは「allowlist にない Bash コマンドは確認プロンプトを出す」
  - background 起動だと**プロンプトに応答できる人間がいない** → 自動拒否扱い
- **解決**: Sprint 6 の Evaluator 成功時はいずれも foreground だった。今回背景化したのが原因

### MCP ツール不在の原因仮説

- 当初仮説: `run_in_background: true` で MCP server attach タイミングが噛み合わない
- 後日（2026-04-24）に foreground でも再現することが判明 → 仮説は不成立
- 真因は別にあった（Sprint 7 Evaluator 評価日のデイリー参照）

### `/fewer-permission-prompts` を試したが効果なし

ユーザーの指示で `/fewer-permission-prompts` スキルを起動。19 セッション分の transcript をスキャンしたが、**頻度 ≥ 3 の read-only コマンドは全て自動許可済みか既存 allowlist 入り**で、追加すべき新規パターンなし。

Evaluator が拒否されたのは主に**書き込み系**（`rm data/app.db*` のワイルドカード違い、`mv data/...` のパス違い、新規 `.evaluator_tmp/check-db.mjs` 実行など）で、本スキルの対象外（read-only のみ追加対象）。

## 変更ファイル

- `~/.claude/projects/C--ConsultationApplication/memory/feedback_evaluator-foreground.md` 新規（フィードバックメモリ）
- `~/.claude/projects/C--ConsultationApplication/memory/MEMORY.md` に索引追加

タスクリスト（TaskUpdate）: #12 Evaluator Sprint 7 合否判定は in_progress のまま継続（再実行待ち）

## 次やること

- 翌日（2026-04-24）に Evaluator を **foreground** で再実行
- それでも MCP が attach されなければ、原因を別軸で調査（playwright スコープ、subagent 設定書式 など）
