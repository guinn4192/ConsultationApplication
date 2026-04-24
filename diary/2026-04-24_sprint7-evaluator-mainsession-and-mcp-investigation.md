# Sprint 7 Evaluator メインセッション直接実行 + MCP 継承問題調査

**日付**: 2026-04-24
**関連スプリント**: Sprint 7（評価フェーズ） / 運用改善（MCP 継承問題）

## やったこと

### 1. Evaluator サブエージェントを foreground で再実行

前日の反省を踏まえて `run_in_background` を指定せず再起動。が、**Playwright MCP ツールが依然として attach されていない**ことが判明。Bash 権限は foreground なので動く（プロンプトに人間が応答可）が、MCP が見えないため UI 操作不可で停止報告。

つまり前日の MCP attach 失敗は **background 起動が原因ではなかった**。

### 2. ユーザー判断: 今回はメインセッションから直接 Playwright MCP を操作

「次回以降の恒久対策は別途検討するとして、今回は私（メインセッション）が Playwright MCP を直接使って評価を実行」とのこと。

Evaluator サブエージェントの「主評価者の独立性」原則からは外れるが、ユーザー承認のもと例外的に main から実行。

### 3. Sprint 7 評価実施（メインセッションから）

Playwright MCP ツール（deferred）をロード → 全シナリオ実行 → レポート生成。

#### テスト範囲（34 基準）

| カテゴリ | 基準数 | 結果 |
|---|---|---|
| Feature 18 オンボーディング+UUID（P0） | 7 | 全 10/10 |
| Feature 19 DB 永続化（P0） | 5 | 全 10/10 |
| Feature 20 履歴画面（P1） | 6 | 4×10、2×8（バグ #1 影響） |
| Feature 21 会話再開モーダル（P1） | 8 | 全 10/10 |
| Feature 17 + Sprint 1-6 回帰（P0） | 7 | 全 10/10 |
| A11y（Sprint 6 宿題） | 1 | 10/10 |

**判定: ✅ 合格**（平均 9.88 / 10、最低 8、P0 全 10）

#### 発見したバグ（Medium 1 件）

**Bug 1**: 履歴画面 (`#/history`, `#/history/:id`) 表示中、`#chat-container` に `hidden` 属性が設定されているのに CSS `.chat-container { display: flex }` が specificity で勝つため、背後にチャット画面が並んで見える。CSS 1 行追加（`.chat-container[hidden] { display: none !important; }` または `.chat-container:not([hidden])`）で修正可能。

#### 検証スクリプト

- `.evaluator_tmp/check-db.mjs`: DB 直接読み込みで messages / emotion_records 確認
- `.evaluator_tmp/insert-yesterday.mjs`: F21-8 検証用に前日 started_at セッションを INSERT
- `.evaluator_tmp/sprint7-server.log`: サーバ起動ログ

レポート: `specs/evaluations/sprint-7.md`

### 4. MCP 継承問題の恒久対策調査開始

Sprint 7 評価合格後、ユーザーから「次回以降は Sprint 6 と同様に Evaluator サブエージェントから Playwright MCP を使えるようにしてほしい」との指示。タスク #13 で調査開始。

#### claude-code-guide サブエージェントで公式仕様を確認

- `mcpServers:` フィールドは frontmatter で公式サポート（map 形式 / list 形式）
- `tools:` の `"mcp__playwright__*"` ワイルドカードは settings.json では有効、subagent では曖昧
- v2.1.101 / v2.1.117 で subagent × MCP 関連の修正あり → 最近の挙動変化の根拠
- 関連 GitHub Issues: #13898（project-scoped MCP が subagent に届かない）、#46228（OAuth MCP × background subagent）

#### 案 A 試行: `mcpServers:` を list 形式に変更（親の MCP を共有）

```yaml
# Before
mcpServers:
  playwright:
    command: npx
    args: ["@playwright/mcp@latest"]

# After
mcpServers:
  - "playwright"
```

スモークテストでサブエージェント起動 → **Playwright MCP attach されず失敗**。

#### 案 B 試行: playwright を user scope に移動

```bash
claude mcp remove playwright -s local
claude mcp add playwright -s user -- npx @playwright/mcp@latest
```

`claude mcp list` で User scope に移動済み・Connected 確認後、再度サブエージェントスモーク → **依然として attach されず失敗**。

#### evaluator.md を元に戻す

ユーザー指示で `mcpServers:` を map 形式に復元。playwright の scope は User のまま（戻すかどうかは保留）。

タスク #13 は in_progress のまま継続。

## 決めたこと

### サブエージェントの「独立性」原則の例外運用ルール

- 通常: Evaluator はサブエージェントから Playwright MCP で UI テスト実施
- 例外（ツール継承不調時）: ユーザー承認のもとメインセッションから直接 Playwright MCP を呼ぶ
- 例外時のレポート責務: メインセッションが Evaluator フォーマットを厳密に踏襲して `specs/evaluations/sprint-N.md` を書く（テスト手順・スコア・バグ再現を客観的に記述）

### Sprint 7 のリリース判断時の残課題

レポート末尾に明記:
1. Bug 1（chat-container 重なり）修正推奨
2. Evaluator × MCP 継承問題の恒久対策（タスク #13 継続）
3. A11y 網羅（オンボ・履歴・再開モーダルの Tab 順序未検証）
4. 前日 orphan auto-close の実機確認

### MCP 継承問題はまだ未解決

案 A・案 B 失敗。残る案:
- 案 C: `tools:` を個別列挙（`mcp:playwright:browser_navigate` 形式）に変更
- 案 D: Claude Code 自体の再起動でセッション状態を完全クリア → 再現確認
- 案 E: GitHub Issue 報告 / フィードバック送信

## ハマったこと / 解決

### MCP server スコープ変更が subagent に伝播しない

- **症状**: `claude mcp` で local → user scope に移動、`claude mcp list` で Connected 確認、メインセッションでは Playwright MCP ツール使用可能。にもかかわらずサブエージェント起動時にツール一覧に attach されない
- **仮説 1**: 既存メインセッションが起動時の MCP 接続状態をキャッシュしている → セッション再起動で解決の可能性
- **仮説 2**: subagent の MCP 継承ロジックがバージョン依存。v2.1.x の特定バージョンで挙動変化 → Claude Code バージョン確認が必要だったが `claude --version` 実行をユーザーが拒否（理由不明、おそらく別作業優先）
- **未解決**: 翌日以降に追加調査

### `/fewer-permission-prompts` の限界

- 期待: Evaluator が拒否されたコマンドを allowlist に追加できる
- 実態: 本スキルは read-only コマンドのみ対象。Evaluator が拒否されていたのは主に書き込み系（`rm`, `mv`）と新規ファイル `.evaluator_tmp/check-db.mjs` の `node` 実行
- 結論: 個別パターンを `settings.local.json` に手動追加する運用が現実的

## 変更ファイル

- `specs/evaluations/sprint-7.md` 新規（評価レポート）
- `.evaluator_tmp/check-db.mjs` 新規（DB 検証スクリプト）
- `.evaluator_tmp/insert-yesterday.mjs` 新規（前日セッション INSERT）
- `.evaluator_tmp/sprint7-server.log`, `verify-server.log` 新規
- `.evaluator_tmp/db-backup3/` 新規（テスト用 DB 退避）
- `.playwright-mcp/` に大量のスナップショット・コンソールログ追加（17 枚以上）
- `.claude/agents/evaluator.md` 一時的に変更後ロールバック（最終的に元の map 形式に戻し済み）
- `~/.claude.json` Playwright MCP scope を Local → User に変更（保留）

## 次やること

### 直近: 残課題への対応判断

- Bug 1 修正の実施タイミング
- Sprint 7 リリース判断（Evaluator 合格・残課題確認後）
- MCP 継承問題タスク #13 の継続調査

### 後日: MCP 問題の追加調査

- Claude Code セッションを完全再起動して挙動再確認
- 案 C（tools 個別列挙）試行
- それでも解決しない場合、GitHub Issue 報告 or `/feedback` 送信
- playwright MCP scope（現状 User のまま）を元に戻すかの判断
