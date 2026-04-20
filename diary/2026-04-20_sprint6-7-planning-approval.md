# Sprint 6/7 企画〜プラン承認（感情トラッカー + DB永続化）

**日付**: 2026-04-20
**関連スプリント**: Sprint 6（感情トラッカー）/ Sprint 7（匿名ユーザー識別 + DB永続化 + 履歴画面）

## やったこと

### 1. サブエージェント・アーキテクチャ改修（Designer追加）

- 従来 `Planner → Generator → Evaluator` の3段構成に **Designer** を挿入し `Planner → Designer → Generator → Evaluator` に再編
- 新規 `.claude/agents/designer.md` を作成。Plan-First Protocol（設計骨子提示 → ユーザー承認 → DESIGN.md 書き出し）を必須化
- `.claude/agents/planner.md` を更新し、技術選定・DB設計・API設計には踏み込まない方針に変更（Designer担当領域）
- `.claude/agents/generator.md` を更新。SPEC + DESIGN の両方を読む必須フロー、DESIGN.md との整合性チェック項目、逸脱時の停止ルール、DESIGN.md不在時の中断ルールを追加
- `CLAUDE.md` を更新:
  - エージェント表を3→4件に
  - フロー図を Designer 挿入で書き直し
  - 「Plan Mode 運用指針」節を新設（Shift+Tab で Plan Mode に入ってから Designer 起動する推奨5ステップ）
  - ディレクトリ規約に `specs/DESIGN.md` を追加
  - スプリント・ライフサイクルに「0.5. [Designer] DESIGN.md 生成」を追加
  - 「設計変更（DESIGN.md）」ルールを新設

### 2. Sprint 6/7 要件定義 Q&A

ユーザーから `specs/improvement-ideas.md` の「2. 感情トラッカー」実装依頼を受領。以下の Q&A で要件確定:

- **1-C**: AI回答直下に 5段階絵文字セレクタ（😢😟😐🙂😊）をインライン表示
- **2-C**: 「新しい相談を始める」押下時にセッション終了前の変化サマリカードを表示
- **3**: DB永続化は今回スコープ内（技術選定は Designer に委任）
- **4-B**: 直近の気分を AI システムプロンプトに注入しトーン調整
- **5-A**: DESIGN.md の Sprint 別実装ガイドに Sprint 6 章のみ新規追加
- **6-A**: フルサブエージェントパイプラインで進行
- **Q1-B**: 初回アクセス時にユーザー名入力 → サーバ側で UUID 払い出し → `user_name + UUID` ペアで DB 永続化（パスワード不扱い）
- **Q2-C**: 相談メッセージ + 気分記録 + モード/カテゴリ履歴を全て DB に残す
- **Q3-B**: 過去履歴閲覧画面を日付グループで一覧化
- **Q4-A**: サマリカードは「新しい相談を始める」ボタン押下時に表示
- **Q5-A**: AI回答ごとに毎回絵文字セレクタを表示（スキップ可）

### 3. Planner 起動（SPEC.md 更新）

Planner サブエージェントを起動し、`specs/SPEC.md` に以下を追記:
- Feature 14（感情記録UI）
- Feature 15（気分に応じた AI 回答トーン調整）
- Feature 16（本日の変化サマリカード）
- Feature 18（匿名ユーザー識別とオンボーディング）
- Feature 19（相談・気分データの DB 永続化）
- Feature 20（過去の相談履歴閲覧画面）
- Feature 17（既存機能のストリーミング下での互換維持、既存機能の番号振り直し）
- Sprint 6（セッション内体験）/ Sprint 7（DB 永続化）を新設
- 非機能要件に「匿名識別はパスワード等認証情報を扱わない」を追加
- スコープ外から「DB 永続化」を削除、「認証機能は引き続きスコープ外」を明記

### 4. Plan Mode でのプラン策定

メインセッションで Shift+Tab を押して Plan Mode に入り、以下を実施:

- Explore エージェントで既存コード調査（`server.js`, `public/app.js`, 既存関数シグネチャ）
- Plan エージェントで実装プラン策定
- 成果物: `C:\Users\takut\.claude\plans\ok-golden-starfish.md`
  - Sprint 分割方針（6: DBなし / 7: DBあり）
  - 技術選定候補（better-sqlite3, ESM分割, ハッシュルーティング, localStorage）
  - データモデル概要（users/sessions/messages/emotion_records）
  - API 追加エンドポイント7本
  - 感情→トーンマッピング表（1=強共感 〜 5=前向き提案）
  - Sprint 6 / Sprint 7 実装ファイル一覧
  - 再利用すべき既存資産（`addMessage` at app.js:371-397, `buildConversationContext` at server.js:44-59 など）
  - 検証計画（Sprint 6: 7シナリオ / Sprint 7: 6シナリオ）
  - 想定リスク（better-sqlite3 Windowsビルド、ESM移行回帰、race、マルチタブ、UUID衝突）

### 5. プラン承認取得

ユーザーがプラン内容を承認。ただし「トークン残量が少ないため明日以降に実装を繰越」との指示。

- 再開点を auto memory に保存（`memory/project_sprint6-7-in-progress.md` + `MEMORY.md` に索引追加）
- ExitPlanMode は未実行（承認はテキストで取得、実装は翌日以降）

## 決めたこと

### Sprint 分割（Designer 実装ガイドに引き継ぐ）

- **Sprint 6**: Feature 14/15/16 のみ。DB 依存なし、セッション内メモリ保持で完結
- **Sprint 7**: Feature 18/19/20。DB 永続化・オンボーディング・履歴画面
- Sprint 6 のクライアント state (`sessionMessages[]` / `emotions[]`) を Sprint 7 の DB スキーマに 1:1 対応させ、Sprint 6 の成果物を Sprint 7 で廃棄しない構造にする

### Designer に委任する技術判断

- DB 実装候補（better-sqlite3 を推したが、Designer に最終比較を委任）
- ルーティング方式（ハッシュ推奨だが History API との比較を Designer に）
- フロント分割粒度（ESM 推奨だが最終は Designer 判断）
- クライアント識別情報の永続化（localStorage 推奨）

### サブエージェント運用ルール

- Planner → SPEC.md 単独、DB・API設計に踏み込まない
- Designer → DESIGN.md 単独、SPEC.md 書き換え禁止、Plan-First Protocol 必須
- Generator → コード + progress.md、DESIGN.md 逸脱禁止（必要なら停止して報告）
- Evaluator → evaluations/sprint-N.md 単独、UI 操作で検証
- Plan Mode はメインセッションのハーネス機能、サブエージェントからは切替不可

## ハマったこと / 解決

### Designer サブエージェントから Plan Mode に入れない

- **症状**: サブエージェント内から `ExitPlanMode` / Shift+Tab 相当の操作ができない
- **原因**: Plan Mode は Claude Code ハーネス（メインセッション）のみが持つ機能。サブエージェントは独立した会話コンテキスト
- **解決**: Designer に Plan-First Protocol（テキスト返信のみで骨子提示 → ユーザー承認 → 再起動して DESIGN.md 書き出し）を導入。Plan Mode は**メインセッションで Designer 起動前に**入る運用に変更

### プラン承認だけ取って実装を翌日繰越

- **理由**: ユーザーから「トークンが残り少ない」との申告
- **対応**: ExitPlanMode を呼ばず、memory にプロジェクト状態を保存して会話終了
- **保存内容**: `memory/project_sprint6-7-in-progress.md` に「プラン承認済み、Designer 起動待ち、再開は Shift+Tab → Designer」と記載

## 変更ファイル

- `.claude/agents/planner.md` — Designer 引き渡し節を追加、技術詳細禁止明記
- `.claude/agents/designer.md` — 新規作成（Plan-First Protocol、10章出力フォーマット、Mermaid図規定）
- `.claude/agents/generator.md` — SPEC + DESIGN 両読みフロー、DESIGN 整合性チェック、停止ルール追加
- `CLAUDE.md` — エージェント表3→4件、フロー図更新、Plan Mode 節追加、ディレクトリ規約更新、設計変更ルール追加
- `specs/SPEC.md` — Feature 14/15/16/17/18/19/20 追加、Sprint 6/7 新設、非機能要件追加、スコープ外更新
- `C:\Users\takut\.claude\plans\ok-golden-starfish.md` — プラン本体
- `C:\Users\takut\.claude\projects\C--ConsultationApplication\memory\MEMORY.md` — 索引
- `C:\Users\takut\.claude\projects\C--ConsultationApplication\memory\project_sprint6-7-in-progress.md` — 再開点

## 次やること

- Shift+Tab で Plan Mode に入る
- Designer 起動 → Plan-First Protocol で骨子提示 → 承認 → DESIGN.md 生成
- Generator Sprint 6 → Evaluator Sprint 6
- 合格後 Generator Sprint 7 → Evaluator Sprint 7
