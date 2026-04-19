# ConsultationApplication

## サブエージェント・アーキテクチャ

本プロジェクトは4つのサブエージェントで開発を進める。

### エージェント一覧

| Agent | 役割 | 定義ファイル |
|-------|------|-------------|
| **Planner** | 短いプロンプト → 詳細仕様書（何を作るか） | `.claude/agents/planner.md` |
| **Designer** | 仕様書 → 詳細設計書（どう作るか） | `.claude/agents/designer.md` |
| **Generator** | 仕様書 + 設計書 → スプリント実装 + 自己評価 | `.claude/agents/generator.md` |
| **Evaluator** | Playwright MCP → UI操作テスト + 合否判定 | `.claude/agents/evaluator.md` |

### 開発フロー

```
ユーザー（1〜4行プロンプト）
    │
    ▼
 Planner ──→ specs/SPEC.md
    │
    ▼
 [推奨] ユーザーが Shift+Tab で Plan Mode に切り替え
    │
    ▼
 Designer ──(設計骨子提案)──> ユーザー承認
              │
              └──→ specs/DESIGN.md
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

### Plan Mode 運用指針

**詳細設計フェーズ（Designer起動直前）に Plan Mode に入ることを強く推奨する。**

Claude Code の Plan Mode はメインセッションのハーネス機能のため、サブエージェントからは切り替えられない。以下の手順で運用する:

1. Planner が `specs/SPEC.md` を完成させた後、メインセッションで `Shift+Tab` を押して Plan Mode に切り替える
2. Designer サブエージェントを起動する
3. Designer は Plan-First Protocol に従い、まず「設計骨子サマリー」をテキスト返答のみで提示する（`specs/DESIGN.md` は書かない）
4. ユーザーが内容を確認し、`ExitPlanMode` で承認 → Plan Mode を抜ける
5. Designer を再度起動し、承認された内容で `specs/DESIGN.md` を書き出す

Plan Mode を使わない運用も可能だが、その場合も Designer の Plan-First Protocol（提案 → 承認 → 書き込み）は必須。

### ディレクトリ規約

```
specs/
├── SPEC.md                    # Plannerが出力する仕様書（単一ファイル）
├── DESIGN.md                  # Designerが出力する詳細設計書（単一ファイル）
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
   - Designer → `specs/DESIGN.md` のみ書き込み可
   - Generator → ソースコード + `specs/progress.md` のみ書き込み可
   - Evaluator → `specs/evaluations/sprint-N.md` のみ書き込み可
3. 自分の役割を超えた作業をしない（Plannerがコードを書く、Designerが実装する、Evaluatorがコードを修正する等は禁止）

#### Planner固有
- 技術的な実装詳細（DB設計、API設計、フレームワーク選定）には踏み込まない — これらは Designer の責務
- 受け入れ基準はEvaluatorがUI操作でテスト可能な形で記述する
- 仕様変更が必要な場合は `specs/SPEC.md` を直接更新し、変更箇所に `[変更: Sprint N後]` または `[変更: Designer差し戻し YYYY-MM-DD]` タグをつける

#### Designer固有
- `specs/SPEC.md` を書き換えない（矛盾発見時はPlannerに差し戻す）
- 実装コードを書かない
- 必ず Plan-First Protocol（設計骨子提示 → ユーザー承認 → DESIGN.md生成）に従う
- 技術選定は最低2案を比較検討し、選定理由を明記する
- ER図・シーケンス図・ユースケース図は Mermaid 記法でDESIGN.md 内に埋め込む
- Sprint別実装ガイド章を必ず含め、各Sprintで Generator が参照すべき章を明示する

#### Generator固有
- 1回の実行で1スプリントのみ実装する
- 実装前に必ず `specs/SPEC.md` + `specs/DESIGN.md` + `specs/progress.md` を読んで現在地を把握する
- `specs/DESIGN.md` が存在しない場合は「Designer未実行」と報告して中断する
- **DESIGN.md の技術選定・処理方針から逸脱しない**。逸脱が必要な場合はDesignerへの設計変更依頼として報告し、勝手に変えない
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
0. [Planner] specs/SPEC.md 生成（プロジェクト初回のみ / 仕様変更時）
0.5. [Designer] specs/DESIGN.md 生成（プロジェクト初回のみ / 設計変更時）
     ※ Shift+Tab で Plan Mode に入ってから起動を推奨
1. [Generator] specs/SPEC.md + specs/DESIGN.md を読み、次スプリントの機能と設計方針を確認
2. [Generator] 実装
3. [Generator] specs/progress.md に自己評価を追記（DESIGN.md整合性チェック含む）
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

### 仕様変更・設計変更ルール

#### 仕様変更（SPEC.md）
- 実装中に仕様の矛盾や不足を発見した場合、Generatorは `specs/progress.md` に問題を記録し、ユーザーに報告する
- Designerが設計段階で仕様の矛盾を発見した場合、ユーザーに報告してPlannerへの差し戻しを依頼する
- Plannerのみが `specs/SPEC.md` を変更できる
- 仕様変更後、DESIGN.md の該当章も Designer が更新する必要がある

#### 設計変更（DESIGN.md）
- 実装中に設計の問題を発見した場合、Generatorは実装を止めて Designer への設計変更依頼としてユーザーに報告する
- Designerのみが `specs/DESIGN.md` を変更できる
- 設計変更後、影響を受けるスプリントの再評価が必要
