# Sprint 8 評価レポート

## テスト環境

- URL: http://localhost:3000
- 日時: 2026-05-11 JST
- ブラウザ: Playwright MCP (Chromium)
- 検証対象: Feature 22「日替わりの一言メッセージ（今日のひとこと）」
- 検証手法:
  - `page.clock.install({ time: ... })` でクライアント Date を固定し、曜日 × 季節の組み合わせを 28 パターン網羅
  - 静的 ES Module 2 ファイル（`public/js/dailyMessage.js` / `public/js/data/dailyMessages.js`）のロードと辞書 exact 一致確認
  - DevTools Network 監視で `/api/daily*` の追加 API 不在を確認
  - 5 テーマ切替で `.daily-message` の bbox を比較し崩れがないことを確認
- 実行モード: メインセッションから Playwright MCP を直接操作（既知の Evaluator × MCP attach 課題のため）

## 受け入れ基準テスト結果

### Feature 22: 日替わりの一言メッセージ（P2）

| # | 基準 | スコア | 詳細 |
|---|------|--------|------|
| 22-1 | 初期表示時に `[data-daily-message]` 要素が DOM に存在 | 10 | bootstrap 経路でウェルカム直前に `.daily-message` 要素が append される。`.daily-message-text` が空でないことを確認 |
| 22-2 | 曜日・季節に対応した日本語文言が表示 | 10 | `data-weekday` / `data-season` 属性と表示文言が辞書 `MESSAGES[season][weekday]` と一致 |
| 22-3 | Date 固定で対応／別日付で別文言 | 10 | 月曜春 → 「新しい一週間、まずは深呼吸から」／金曜冬 → 「あと一日、自分に『おつかれ』と言ってあげて」を実機確認。曜日・季節を変えると文言が変化する |
| 22-4 | 同一日付でリロードしても同一文言（決定論） | 10 | `page.clock.install()` で同一時刻に固定後 `location.reload()` を 3 回繰り返し、`.daily-message-text` の textContent が完全一致 |
| 22-5 | 「新しい相談を始める」リセット後に再表示 | 10 | 実 LLM への送信 → サマリカード「リセット」確定 → `clearMessages()` で daily-message も消えた後、`performReset()` 経由で `showDailyMessage()` + `showWelcomeMessage()` が再描画 |
| 22-6 | 前向き・優しいトーン（命令調なし） | 9 | 28 文言すべてで禁止ワード（「すべき」「ねばならない」「やれ」等）0 件、全文ユニーク。最終的な人手レビューは別軸として残す |
| 22-7 | サーバ通信なし／専用 API なし | 9 | `/api/daily*` 0 件。Network タブで観測された `daily` を含む URL 2 件は ES Module ファイルの初回ロード（DESIGN §1.7 採用方式 A: 静的 module）であり、SPEC F22 が禁ずる「専用サーバリクエスト」には該当しない |
| 22-8 | 全 5 テーマで表示崩れなし | 10 | default / ocean / forest / night / sakura で `.daily-message` の getBoundingClientRect が 908 × 97.21875 px で完全一致。`var(--color-ai-bubble)` `var(--color-ink-faint)` `var(--color-accent)` `var(--color-text)` `var(--color-text-light)` のみ使用で全テーマに自動追従 |
| 22-9 | 既存ウェルカム破壊なし | 10 | `showWelcomeMessage()` の DOM 構造（`#welcome-message`, `.message-label`, 本文 span）に変更なし。daily-message は独立兄弟要素として ウェルカムの直前に挿入される |
| 22-10 | Playwright `page.clock.install()` シナリオ再現可能 | 10 | DESIGN 付録 C.2 の検証スニペットがそのまま通る。`[data-daily-message][data-weekday='1'][data-season='spring']` セレクタで頑強に取得可能 |

### 28 パターン網羅テスト

春・夏・秋・冬 × 日〜土の 28 組み合わせすべてで、`data-weekday` / `data-season` 属性値と表示文言が辞書 exact 一致: **28 / 28 PASS**

| 季節 ＼ 曜日 | 日 | 月 | 火 | 水 | 木 | 金 | 土 |
|--------------|----|----|----|----|----|----|----|
| 春 (3–5月)  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 夏 (6–8月)  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 秋 (9–11月) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 冬 (12–2月) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 回帰テスト（Sprint 1–7 主要機能 / P0）

| # | 基準 | スコア | 詳細 |
|---|------|--------|------|
| R-1 | ストリーミング送信成功 | 10 | AI 回答 327 文字を逐次描画、`streaming-done` クラス付与で完結 |
| R-2 | ストリーミング中の入力欄非活性 | 10 | `input.disabled = true`、`sendButton.disabled = true`、`newConsultationButton.disabled = true` 全て確認 |
| R-3 | 絵文字記録 (F14) | 10 | 5 ボタン描画、🙂 クリックで `.active` 付与、DB `emotion_records` への保存も確認 |
| R-4 | サマリカード (F16) | 10 | 「本日の変化」モーダル表示・閉じる・リセット両ボタン動作 |
| R-5 | 履歴画面遷移 (F20) | 10 | `#/history` および `#/history/:sessionId` 双方とも遷移動作 |
| R-6 | 再開モーダル「続きから」(F21) | 10 | onResume 経路では `[data-daily-message]` が **非表示**（DESIGN §4.6.3 #5 通り、既存メッセージ尊重） |
| R-7 | 5 テーマ切替 (F17) | 10 | 🍂🌊🌿🌙🌸 すべて `document.documentElement.dataset.theme` が正しく更新 |

## スコアサマリー

- **総基準数**: 17（F22: 10 + 回帰: 7）
- **平均スコア**: 9.8 / 10
- **最低スコア**: 9（22-6 トーン人手レビュー余地、22-7 静的 module ロード 2 件の説明書き）
- **P0 機能スコア（回帰）**: 10.0 / 10
- **P2 機能スコア（F22）**: 9.8 / 10
- **28 パターン網羅**: 28 / 28 PASS

## 軽微指摘（不合格事由ではない）

1. **静的 module ロード 2 件の解釈**: Network タブで `daily` を含む URL 2 件が観測されたが、これは `public/js/dailyMessage.js` および `public/js/data/dailyMessages.js` の初回 ES Module ロードであり、DESIGN §1.7 で採用された方式 A（クライアント完結・サーバ専用 API なし）の想定どおり。SPEC F22 が禁ずる「専用サーバリクエスト」には該当しない。
2. **トーンの最終確認**: 28 文言は機械的キーワード除外（命令調・ネガティブ表現）で担保。日本語ネイティブによる文学的レビューはオプションとして残せる。
3. **「続きから」経路の daily-message 非表示**: これは DESIGN §4.6.1 / §4.6.3 #5 に明文化された設計どおり（既存メッセージが残っている文脈で「今日のひとこと」を被せない）。仕様逸脱ではない。

## 判定: ✅ 合格

### 合格条件の確認（CLAUDE.md）

- 全基準の平均スコア ≥ 7.0: **9.8** ✅
- 個別基準の最低スコア ≥ 4: **9** ✅
- P0 機能（回帰対象）のスコア ≥ 8: **10** ✅
- Sprint 1–7 機能の回帰なし: ✅

### リリース判断時の残課題

1. **トーンの人手レビュー**: P2 機能のため必須ではないが、28 文言を日本語ネイティブが読み通して違和感のあるものを差し替える余地はある（DESIGN §8.3 の辞書レビュー手順に従い、Designer 経由で SPEC/DESIGN を変えずに辞書の文言のみ調整可能）
2. **タイムゾーン**: クライアントローカル日付ベースで決定論（DESIGN §9 R11 で明示）。海外旅行等で日付境界を跨いだ場合の体験は別途検討対象
3. **時刻帯出し分け（朝/昼/夜）**: SPEC F22 スコープ外として明示済み。将来の拡張として保留

### 関連ファイル

- スクリーンショット 10 枚: `specs/evaluations/screenshots/sprint-8-*.png`
  - `sprint-8-tc1-monday-spring.png`（月曜春の DOM 確認）
  - `sprint-8-tc2-friday-winter.png`（金曜冬の別文言）
  - `sprint-8-tc4-after-reset.png`（リセット後再表示）
  - `sprint-8-tc5-resume.png`（続きから経路で daily-message 非表示）
  - `sprint-8-tc6-theme-{default,ocean,forest,night,sakura}.png`（5 テーマ）
  - `sprint-8-tc9-regression.png`（回帰）
- テストスクリプト: `tmp/sprint8_eval.js`
- 結果 JSON: `tmp/sprint8_results.json`
- 実装ファイル:
  - 新規 `public/js/data/dailyMessages.js`
  - 新規 `public/js/dailyMessage.js`
  - 拡張 `public/js/ui/chat.js`
  - 拡張 `public/js/main.js`
  - 拡張 `public/style.css`
