# Sprint 6/7 DESIGN.md 生成 + Feature 21（会話再開プロンプト）追加

**日付**: 2026-04-21
**関連スプリント**: Sprint 6（感情トラッカー）/ Sprint 7（DB永続化 + 会話継続）

## やったこと

### 1. 昨日の再開点確認

- メインセッションを再開し、`memory/MEMORY.md` → `project_sprint6-7-in-progress.md` を読んで状態復元
- 再開点: 「プラン承認済み、Designer 起動待ち、再開は Shift+Tab → Designer」
- SPEC.md は Feature 14-20 と Sprint 6/7 定義が追記済み、DESIGN.md は未作成であることを `ls specs/` で確認

### 2. Designer 起動1回目（設計骨子提示）

Plan Mode 下で Designer サブエージェント起動。Plan-First Protocol に従い、DESIGN.md は書かずにテキスト返信のみで骨子を提示させた。

骨子で確定した設計判断:

- **DB**: better-sqlite3 v11 第1候補、失敗時フォールバックとして `src/db/driver.js` で `node:sqlite` 抽象化（代替検討: sql.js, LowDB）
- **フロント分割**: ESM（`public/js/*.js`）、段階移行（main.js 空殻 → 順次抽出）（代替検討: 単一 app.js 維持, Vite+React）
- **ルーティング**: ハッシュベース（代替検討: History API → Express 側全ルート fallback 必要で却下）
- **クライアント永続化**: localStorage（代替検討: IndexedDB → 非同期 API で過剰, Cookie → XSS/CSRF 追加対策必要で却下）
- **セッション境界**: 初回相談送信時に `POST /api/sessions`、リセット時 `POST /api/sessions/:id/close`、起動時 orphan 自動 close
- **lastEmotion 送信方式**: request body（ヘッダは絵文字 escape 必要、クエリは SSE POST と冗長）
- **トーン addendum**: `buildConversationContext()` 末尾 append、モードを**上書きせず補足**する形で「モードの指示を踏まえた上で」で始める固定ルール
- **Sprint 6→7 互換**: `state.sessionId` / `message.id` を Sprint 6 からクライアント UUID 採番 → Sprint 7 で DB PK に流用
- **マルチタブ**: better-sqlite3 WAL モード有効化、各タブ独立 sessionId
- **サマリ中盤定義**: 記録 N 件のうち `floor(N/2)` 番目（Evaluator 判定ぶれ防止で明文化）

骨子をプランファイル `ok-golden-starfish.md` 末尾に統合してから ExitPlanMode を呼び、プラン承認を取得。

### 3. Designer 起動2回目（DESIGN.md 本体生成）

承認済み骨子を引き継ぎ、Designer 再起動で `specs/DESIGN.md` を書き出し。

出力:
- **パス**: `C:\ConsultationApplication\specs\DESIGN.md`（47KB）
- **構成**: 10章 + 付録 A/B
  1. 技術選定（DB / フロント分割 / ルーティング / 永続化 の4項目、各2案以上比較）
  2. アーキテクチャ（Sprint 6 / Sprint 7 の2枚の Mermaid 図、ディレクトリ構成）
  3. ユースケース図（新規/継続/履歴閲覧3アクター）
  4. シーケンス図4本（オンボーディング / 相談+ストリーミング+絵文字 / リセット+サマリ+close / 履歴閲覧）
  5. データモデル（ER 図 + スキーマ詳細表 + 3インデックス）
  6. API 設計（エンドポイント7本 + TypeScript 型定義）
  7. 処理方針（エラーハンドリング / バリデーション / 非同期 / セキュリティ / ロギング / セッション境界 / 起動シーケンス）
  8. Sprint 別実装ガイド（Sprint 6 / Sprint 7 の章）
  9. 想定リスク（R1-R7）
  10. スコープ外の技術判断
  - 付録 A: Sprint 間互換マトリクス
  - 付録 B: Evaluator 検証観点の追補
- **Mermaid 図**: 計 8 枚
- **SPEC 矛盾**: なし

### 4. UX ギャップ発見 → Feature 21 追加

ユーザーから鋭い指摘:

> 実装してこの設計だと、一度アプリを離れたユーザが再度会話の続きをするにはどうしたらいいだろう？

設計を見直したところ、以下のギャップを発見:

- ブラウザを閉じる → 再訪: `userUuid` は localStorage 復元できるが `state.sessionId` と `sessionMessages[]` はメモリのみ → 失われる
- 履歴画面（Feature 20）は **閲覧専用** のため、過去会話を開いても「続き」を送信できない
- 未 close セッションが DB には残るが、UI から再開する導線が存在しない

3つの対応案を提示:

| 案 | 挙動 | トレードオフ |
|---|---|---|
| A. 自動レジューム | 起動時に未 close セッションを自動復元 | 毎回リセット操作が必要 |
| B. 明示プロンプト | 「続きから / 新しく始める」モーダル | 1クリック増えるが意図明確 |
| C. 履歴画面から再開 | F20 に「続ける」ボタン追加 | SPEC「閲覧のみ」条項に抵触 |

ユーザーが **B 案** を選択。

### 5. Planner 起動（SPEC.md に Feature 21 追加）

Planner サブエージェントを起動し、`specs/SPEC.md` に以下を追記:

- **Feature 21: 中断した会話の再開プロンプト** [追加: Sprint 6後]（優先度 P1、9項目の受け入れ基準）
- Sprint 7 タイトルを「匿名ユーザー識別とデータ永続化・会話継続 [変更: Sprint 6後]」に変更
- Sprint 7 ゴール文に会話継続の文言を追加
- 非機能要件に「再訪時の会話継続は当日のみを対象」を追加
- スコープ外に「前日以前のセッションからの会話再開」を追加

既存 Feature 1-20 および Sprint 1-6 は無変更。

### 6. Designer 起動3回目（DESIGN.md に Feature 21 設計追記）

Designer サブエージェントを起動し、`specs/DESIGN.md` を v1.0 → v1.1 へ昇格、Feature 21 設計を**差分追記**。

更新箇所:
- 冒頭メタ v1.1 化
- §3 ユースケース図に UC12（中断会話の再開）追加
- §4.5 シーケンス図「再訪時の再開プロンプト」新規追加（該当あり/なし × 続きから/新しく始める の分岐フロー）
- §5.3 インデックスに再開判定クエリ例追加（既存 `sessions(user_uuid, started_at DESC)` で対応可）
- §6.1 エンドポイント一覧に `GET /api/sessions/resumable?uuid=...` 追加、close の冪等化注記
- §6.2 型定義に `ResumableSessionResponse`、`CloseSessionRes.alreadyClosed` 追加
- §7.6 再開時の整合性（新規）: state 差し替え、復元 messages を即時描画、emotion_records 注入で絵文字復元
- §8.2 Sprint 7 実装ガイドに Feature 21 実装要素・依存・注意点を追補
- §9 リスクに R8（close 冪等化）、R9（モーダル中の書き込み競合）追加
- §10 スコープ外に項目 11-13（前日以前、複数候補、過去発言編集）追加
- 付録 A: Feature 21 を Sprint 間互換マトリクスに追加
- 付録 B: Feature 21 の Evaluator 検証観点 6 項目追加

SPEC 矛盾: なし。

## 決めたこと

### 「続きから再開」の対象範囲は当日のみ

- **Why**: 古いセッションまで再開対象にすると、何日も前の忘れかけた話題が突然モーダルに出てきてユーザーを戸惑わせる
- **境界**: `DATE(started_at) = DATE('now')` かつ `closed_at IS NULL` の最新1件のみ
- **前日以前の閲覧**: 履歴画面（Feature 20）から閲覧専用で参照可能。追記は不可

### 複数候補のピッカーは出さない（最新1件のみ）

- **Why**: マルチタブ起因で同一ユーザーに複数の未 close セッションが存在しうるが、ユーザーが UI で選ぶ場面を作るとフローが複雑化する
- **挙動**: 最新 `started_at` のもの 1 件のみを候補に提示。他は履歴画面からアクセス

### close エンドポイントの冪等化

- **Why**: マルチタブで同時に「新しく始める」を押すと、古いセッションを二重 close しようとしてエラーになる可能性
- **対応**: 既に closed のセッションに対する close 要求は 200 OK を返し `alreadyClosed: true` フラグで伝える

### モーダル表示中の書き込み競合対策は任意

- **Why**: 別タブで相談送信されるとモーダル側の復元データが古くなる可能性があるが、実装負荷と発生確率を天秤にかけた結果、Sprint 7 では**省略可**（実装するなら「続きから」押下時に `GET /resumable` を再度呼ぶ）
- **明文化**: DESIGN.md §9 R9 に「任意、実装負荷次第で省略可」と明記

## ハマったこと / 解決

### Designer 骨子提示フェーズで Plan Mode 下のファイル書き込み制限

- **症状**: Plan Mode 下では `specs/DESIGN.md` を書き込めない（Plan file のみ編集可）
- **対応**: Designer が骨子をテキスト返信のみで提示 → ユーザー承認 → プランファイルに骨子を統合 → ExitPlanMode → Plan Mode を抜けた状態で Designer を再起動して DESIGN.md 本体を書き出す2段構え
- **確認**: Designer の Plan-First Protocol 設計がそのまま Plan Mode 運用にも整合することを確認

### Feature 21 追加時の作業順序

- **問題**: SPEC 更新と DESIGN 更新のどちらを先にすべきか迷った
- **結論**: Planner → Designer の順。Planner が SPEC.md を先に確定させないと、Designer が何を設計すべきか決まらない
- **根拠**: `CLAUDE.md` のスプリント・ライフサイクルおよび「仕様変更→設計変更」の順序ルール

## 変更ファイル

- `specs/SPEC.md` — Feature 21 追加、Sprint 7 タイトル変更、非機能要件追加、スコープ外追加
- `specs/DESIGN.md` — v1.0 新規作成 → v1.1 差分更新（Feature 21 対応の §3/§4.5/§5.3/§6/§7.6/§8.2/§9/§10/付録 A・B を追記）
- `C:\Users\takut\.claude\plans\ok-golden-starfish.md` — Designer 骨子提示セクションを末尾に統合（ExitPlanMode 承認対象）
- `diary/2026-04-20_sprint6-7-planning-approval.md` — 昨日分の日報（本記録と同時作成）
- タスクリスト（TaskUpdate）: #6 切替待ち → completed, #7 設計骨子提案 → completed, #8 DESIGN.md 書き出し → completed

## 次やること

### 直近: Sprint 6 実装

- Generator サブエージェント起動で Sprint 6 実装（Feature 14/15/16 + Feature 17 回帰）
- 対象ファイル:
  - `public/app.js` → `public/js/{main,state,api}.js` + `public/js/ui/{chat,emotion,summary,shared}.js` に ES Modules 分割
  - `public/js/ui/emotion.js` 新規（5絵文字セレクタ）
  - `public/js/ui/summary.js` 新規（サマリカードモーダル）
  - `public/index.html` モジュール化、サマリコンテナ追加
  - `public/style.css` 絵文字・サマリカード sketchy スタイル追加
  - `server.js` `/api/consult/stream` に `lastEmotion` 受領 + `buildConversationContext()` にトーン addendum
- Sprint 6 は DB 非依存、メモリ保持のみで完結

### その後: Evaluator Sprint 6 → Generator Sprint 7 → Evaluator Sprint 7

- Sprint 7 は DB 導入 + オンボーディング + 履歴画面 + Feature 21（再開プロンプト）
- Evaluator は Playwright MCP で Sprint 6 は 7 シナリオ、Sprint 7 は 6 シナリオ + Feature 21 再開シナリオを検証

### 懸念点（Generator 着手前に確認すべき）

- better-sqlite3 Windows ネイティブビルドの動作確認（Sprint 7 着手時）
- ESM 分割前に Sprint 5 のスクショを取って回帰比較できるようにする
- Feature 21 受け入れ基準の「初回訪問時にモーダル表示しない」の優先順（Feature 18 オンボーディング → Feature 21 再開判定 → 通常画面）を main.js の起動シーケンスで守る
