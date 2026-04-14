# ConsultationApplication

## サブエージェント・アーキテクチャ

本プロジェクトは3つのサブエージェントで開発を進める。

### エージェント一覧

| Agent | 役割 | 定義ファイル |
|-------|------|-------------|
| **Planner** | 短いプロンプト → 詳細仕様書 | `.claude/agents/planner.md` |
| **Generator** | 仕様書 → スプリント実装 + 自己評価 | `.claude/agents/generator.md` |
| **Evaluator** | Playwright MCP → UI操作テスト + 合否判定 | `.claude/agents/evaluator.md` |

### 開発フロー

```
ユーザー（1〜4行プロンプト）
    │
    ▼
 Planner ──→ specs/SPEC.md
    │
    ▼
 Generator ──→ コード実装 + specs/progress.md
    │
    ▼
 Evaluator ──→ specs/evaluations/sprint-N.md
    │
    ├─ 合格 → 次スプリントへ（Generatorに戻る）
    └─ 不合格 → Generatorに修正指示 → 再実装 → 再評価
```

### ディレクトリ規約

```
specs/
├── SPEC.md                    # Plannerが出力する仕様書（単一ファイル）
├── progress.md                # Generatorが追記する自己評価ログ
└── evaluations/
    ├── sprint-1.md            # Evaluatorのスプリント別評価レポート
    ├── sprint-2.md
    └── ...
```

- `specs/` ディレクトリはエージェント間通信の唯一のインターフェース
- エージェント同士は直接やり取りしない。必ずファイル経由で情報を受け渡す

### ルール

#### 全エージェント共通
1. `specs/` 配下のファイルフォーマットを勝手に変更しない
2. 他エージェントの担当ファイルを上書きしない
   - Planner → `specs/SPEC.md` のみ書き込み可
   - Generator → ソースコード + `specs/progress.md` のみ書き込み可
   - Evaluator → `specs/evaluations/sprint-N.md` のみ書き込み可
3. 自分の役割を超えた作業をしない（PlannerがコードOを書く、Evaluatorがコードを修正する等は禁止）

#### Planner固有
- 技術的な実装詳細（DB設計、API設計、フレームワーク選定）には踏み込まない
- 受け入れ基準はEvaluatorがUI操作でテスト可能な形で記述する
- 仕様変更が必要な場合は `specs/SPEC.md` を直接更新し、変更箇所に `[変更: Sprint N後]` タグをつける

#### Generator固有
- 1回の実行で1スプリントのみ実装する
- 実装前に必ず `specs/SPEC.md` と `specs/progress.md` を読んで現在地を把握する
- Evaluatorが不合格を出した場合、`specs/evaluations/sprint-N.md` のフィードバックに必ず対応してから次スプリントに進む
- 自己評価は過大評価しない。未達は未達として正直に記載する
- 仕様書にない機能を勝手に追加しない

#### Evaluator固有
- コードを直接読んで合否判断しない。必ずPlaywright MCPでUI操作して検証する
- テスト前にアプリが起動しているか確認し、起動していなければ起動する
- スコアは客観的につける（Generatorへの忖度なし）
- バグ報告には必ず再現手順を含める
- 前スプリントの機能に対する回帰テストを必ず実施する

### スプリント・ライフサイクル

```
1. [Generator] specs/SPEC.md を読み、次スプリントの機能を確認
2. [Generator] 実装
3. [Generator] specs/progress.md に自己評価を追記
4. [Evaluator] Playwright MCPでテスト実行
5. [Evaluator] specs/evaluations/sprint-N.md にレポート出力
6. 判定分岐:
   - 合格 → ステップ1に戻り次スプリント
   - 不合格 → [Generator] フィードバック対応 → ステップ4に戻る
7. 不合格の再試行は最大3回。3回不合格ならユーザーに判断を仰ぐ
```

### 合格基準（Evaluator判定）

| 条件 | 閾値 |
|------|------|
| 全基準の平均スコア | ≥ 7.0 / 10 |
| 個別基準の最低スコア | ≥ 4 / 10 |
| P0機能のスコア | ≥ 8 / 10 |
| 回帰テスト | 前スプリント機能に破壊なし |

1つでも下回ればスプリント不合格。

### 仕様変更ルール

- 実装中に仕様の矛盾や不足を発見した場合、Generatorは `specs/progress.md` に問題を記録し、ユーザーに報告する
- Plannerのみが `specs/SPEC.md` を変更できる
- 仕様変更後、影響を受けるスプリントの再評価が必要
