# Sprint 6 実装 + Evaluator 合格（感情トラッカー完了）

**日付**: 2026-04-21（同日、設計完了後の続き）
**関連スプリント**: Sprint 6（感情記録UI + 気分トーン調整 + 変化サマリカード + 既存機能回帰）
**前記録**: `diary/2026-04-21_sprint6-7-design-book-and-feature21.md`（SPEC + DESIGN 整備）

## やったこと

### 1. Generator サブエージェント起動（Sprint 6 実装）

承認済み SPEC/DESIGN に基づき Generator を起動。Sprint 6 の 3 機能 + 既存機能回帰保全を実装。

#### Feature 14: 感情記録UI（インライン絵文字セレクタ）
- AI 回答のストリーミング完了後に 5 絵文字（😢😟😐🙂😊）セレクタを直下に挿入
- クリックで選択・上書き、未選択スキップ可
- `aria-pressed` / `aria-label` でアクセシビリティ対応
- 各回答に独立したセレクタ（他回答の選択に影響しない）

#### Feature 15: 気分に応じた AI 回答トーン調整
- `server.js` の `buildConversationContext()` 末尾に `TONE_ADDENDUM` を append
- 全 addendum は **「モードの指示を踏まえた上で」で始まる固定ルール**（R7: モード上書き誤認対策）
- マッピング:
  - 1 (😢): 強い共感・傾聴
  - 2 (😟): 不安に寄り添う、選択肢を並べる
  - 3 (😐): addendum なし（従来モード基準）
  - 4 (🙂): ポジティブな継続支援
  - 5 (😊): 前向きな一歩の提案

#### Feature 16: 本日の変化サマリカード
- 「新しい相談を始める」押下時に**会話履歴クリア前に**モーダル表示
- 3 ポイント可視化: 開始 / 中盤（`floor(N/2)` 番目）/ 最終
- 変化矢印（↗ / → / ↘）+ 色で変化方向を視覚化
- N=0: 「記録がありません」、N=1: 1 ポイント表示
- 「リセット」「閉じる」2 ボタン

#### Feature 17: 既存機能回帰保全
- Sprint 5 の SSE ロジック（`res.on("close")` / `AbortController` / `safeWrite` / finally `res.end()` / ping）を完全保持
- カテゴリ・モード・テーマ・文字数カウンタ・会話履歴維持・Enter 送信 すべて破壊なし

### 2. ES Modules 段階移行（DESIGN.md §8.1 準拠）

`public/app.js`（478行）を以下に分割:

| 新ファイル | 責務 |
|---|---|
| `public/js/main.js` | エントリポイント、DOMContentLoaded |
| `public/js/state.js` | `sessionId` / `sessionMessages[]` / `emotions[]` 単一ソース、イベント購読 |
| `public/js/api.js` | fetch ラッパ（Sprint 7 ヘッダ拡張予定、今回は素通し） |
| `public/js/ui/chat.js` | `addMessage` / `addStreamingMessage` / `scrollToBottom` / `showWelcomeMessage` |
| `public/js/ui/emotion.js` | 絵文字セレクタ（ホバー/選択/上書き） |
| `public/js/ui/summary.js` | サマリカードモーダル |
| `public/js/ui/shared.js` | `setLoading` / `updateCharCount` / テーマ・カテゴリ・モード切替 |

- `state.sessionId` は Sprint 6 からクライアント `crypto.randomUUID()` で採番（Sprint 7 で DB PK に流用）
- 各 message オブジェクトに `id`（UUID）と `state: "streaming" | "done"` を持たせ R3 race 対策
- 旧 `public/app.js` は `public/app.js.sprint5.bak` として保全

### 3. Generator 自己評価

`specs/progress.md` 339-470 行に Sprint 6 自己評価を追記。

**総合自己評価: A**
- 受け入れ基準の達成状況: 全基準 ✅
- DESIGN.md との整合: 完全一致
- 技術的判断: ESM 分割の粒度、TONE_ADDENDUM の append 方式、R3 対策の `message.state` FSM
- 既知の問題: キーボード操作（Tab→Enter/Space）が絵文字セレクタで有効か未確認
- Sprint 7 への申し送り: state 接続点、後方互換 body、DB PK 流用方針

### 4. Evaluator サブエージェント起動（Playwright MCP）

Playwright MCP Chromium で Sprint 6 の UI 操作テスト実施。サーバは `npm start` で `http://localhost:3000` 起動（既存）。実 API コール（`.env` の ANTHROPIC_API_KEY）を使用。

#### 検証シナリオ数

- Feature 14（絵文字セレクタ）: 8 シナリオ
- Feature 15（トーン調整）: 4 シナリオ（うち 1 件は R7 クロステスト: モード=解決 × 気分=😢）
- Feature 16（サマリカード）: 6 シナリオ（N=0, N=1, N=2以上, floor 中盤検証）
- Feature 17（回帰）: 8 シナリオ（カテゴリ / モード / 全 5 テーマ / 文字数 / リセット / 文脈維持 / Enter / console errors）
- **合計**: 27 受け入れ基準

#### 結果

**✅ 合格（全 27 基準で満点、平均 10.00 / 10）**

| カテゴリ | 基準数 | 平均スコア |
|---|---|---|
| Feature 14 (P0) | 8 | 10.0 |
| Feature 15 (P0) | 4 | 10.0 |
| Feature 16 (P1) | 6 | 10.0 |
| Feature 17 (P0) | 8 | 10.0 |
| 回帰テスト | 8 | 破壊なし |

#### Evaluator 追加検証

サマリカードの中盤定義 `floor(N/2)` を複数 N 値で検証:
- N=4: index=2 → 3 件目の絵文字が中盤に表示
- N=5: index=2 → 3 件目
- N=6: index=3 → 4 件目
- ドライバスクリプトを `.evaluator_tmp/test-sprint6.mjs`, `verify-middle-N{4,5,6}.mjs` として保存

レポート: `specs/evaluations/sprint-6.md`

## 決めたこと

### DESIGN.md の `floor(N/2)` は **append-only 履歴基準**

- **争点**: サマリカードの中盤インデックスを「画面に見えているアクティブ絵文字の列」で数えるか、「感情記録の append-only 履歴全件」で数えるか
- **確定**: 後者（append-only 履歴）。絵文字を上書きした場合でも履歴には全て残り、`floor(N/2)` は**上書き前の中間記録**を指す
- **影響**: ユーザー視覚上「選択済み 😢→🙂 の 1 件」に見える場合でも、履歴的には N=2 として扱う
- **次アクション**: Sprint 7 の履歴画面（Feature 20）で同じロジックを使う際、UI 説明文にこの定義を明記する

### Sprint 6 の `/api/consult/stream` は後方互換仕様

- body に `sessionId` / `userUuid` / `messageId` を含めても Sprint 6 では**黙って無視**
- Sprint 7 で messages INSERT + `event: done` data に `assistantMessageId` 追加予定
- Generator は Sprint 7 着手時にクライアント採番 ID とサーバ返却 ID の優先関係を確認する必要あり

### キーボード操作テストは Sprint 7 にキャリーオーバー

- SPEC 非機能要件「マウス・タッチ・キーボード」のうちキーボードは Sprint 6 で未検証
- Sprint 7 の A11y 対応（履歴画面のフォーカス順、ARIA ライブリージョン等）と同時に絵文字セレクタの Tab → Enter/Space 操作も確認する

## ハマったこと / 解決

### ストリーミング完了検出と絵文字表示の race（R3）

- **症状（想定）**: SSE の `event: done` を受信する前に UI で絵文字セレクタを描画しようとすると、回答途中でセレクタが出現してしまう
- **対策**: message オブジェクトに `state: "streaming" | "done"` フィールドを持たせ、`done` 遷移を `state.js` のイベント購読（`onMessageDone`）で検知してから `emotion.js` の `renderEmotionSelector(messageId)` を呼び出す
- **検証**: Evaluator の Feature 14 シナリオ 8（ストリーミング中に絵文字が出現しない）で合格

### モード × 気分のクロス（R7）

- **症状（想定）**: トーン addendum が既存モード指示を上書きし、「解決モード + 気分 😢」でも共感のみになってしまう恐れ
- **対策**: 全 addendum を「モードの指示を踏まえた上で、補足：…」の形式に固定。モード本体を改変しない
- **検証**: Evaluator シナリオで「解決モード × 気分 😢」を実 API 呼び出しで検証し、AI 回答に「解決プロセス＋共感表現」が両立することを確認（`.evaluator_tmp/f15-*-reply.txt` にサンプル保存）

### ESM 移行の回帰懸念（R2）

- **症状（想定）**: `public/app.js` を複数モジュールに分割すると、既存の DOM 参照やイベントリスナが動かなくなる可能性
- **対策**: 分割を機能単位で区切り（state / api / ui/chat / ui/emotion / ui/summary / ui/shared）、既存 Class/ID は一切変更しない。エントリポイント `main.js` で DOMContentLoaded → 各 UI モジュール init 呼び出しの順序を固定
- **検証**: Sprint 5 の全受け入れ基準（ストリーミング / テーマ / モード / カテゴリ / 文字数 / 新相談 / Enter 送信）を Evaluator が回帰パスで再実行、破壊なし

## 変更ファイル

### 新規
- `public/js/main.js`
- `public/js/state.js`
- `public/js/api.js`
- `public/js/ui/chat.js`
- `public/js/ui/emotion.js`
- `public/js/ui/summary.js`
- `public/js/ui/shared.js`
- `specs/evaluations/sprint-6.md` — Evaluator レポート

### 更新
- `server.js` — TONE_ADDENDUM 追加、body `lastEmotion` 受領、後方互換の `sessionId` / `userUuid` / `messageId` 吸収
- `public/index.html` — `<script type="module" src="js/main.js">` 切替、`<div id="summary-modal">` 追加
- `public/style.css` — 絵文字セレクタ・サマリカード sketchy スタイル追加（5 テーマ全対応）
- `specs/progress.md` — Sprint 6 自己評価を 339-470 行に追記

### 削除（保全）
- `public/app.js` → `public/app.js.sprint5.bak` にリネーム（Sprint 7 で不要と確認したら完全削除）

### テスト成果物
- `.evaluator_tmp/test-sprint6.mjs` — Playwright MCP ドライバスクリプト
- `.evaluator_tmp/verify-middle-N{4,5,6}.mjs` — 中盤計算追加検証
- `.evaluator_tmp/f15-*-reply.txt`, `f17-*-reply.txt`, `f17-*.txt` — AI 回答サンプル

## 次やること

### Sprint 7 実装（DB 永続化 + オンボーディング + 履歴 + F21 再開）

必要な新規ファイル:
- `src/db/driver.js` — better-sqlite3 / node:sqlite 抽象
- `src/db/schema.js` — テーブル作成 + WAL モード有効化
- `src/db/repo.js` — users / sessions / messages / emotion_records CRUD
- `src/routes/{user,sessions,emotions,history}.js` — Express ルーター分割
- `public/js/router.js` — ハッシュルーティング
- `public/js/ui/onboarding.js` — 初回画面
- `public/js/ui/history.js` — 日付別一覧 + セッション詳細
- `public/js/ui/resume.js` — Feature 21 再開モーダル
- `data/.gitignore` — `*.db*` 除外

必要な更新:
- `package.json` — `better-sqlite3` 依存追加
- `server.js` — DB 初期化、ルート登録、`x-user-uuid` ヘッダ受領、`/api/consult/stream` に `sessionId` / `userUuid` 受領追加
- `public/js/state.js` — `setUserUuid(uuid)` メソッド追加、localStorage 同期
- `public/js/api.js` — `x-user-uuid` ヘッダ自動付与
- `public/index.html` — ヘッダに「過去の相談履歴」リンク、オンボーディング・履歴画面コンテナ

### Sprint 7 着手前の確認事項

1. `better-sqlite3` の Windows ネイティブビルドが通るか（`npm install` で事前確認）
2. `.env` の `ANTHROPIC_API_KEY` は Sprint 7 でも継続利用
3. Sprint 6 で保全した `public/app.js.sprint5.bak` は Sprint 7 着手前に削除して良いか確認

### コミット方針

Sprint 6 は独立した大きな変更なので単独コミット推奨:
- コミット対象: `server.js`, `public/index.html`, `public/style.css`, `public/js/**`, `specs/progress.md`, `specs/evaluations/sprint-6.md`, `diary/2026-04-20_*.md`, `diary/2026-04-21_*.md`
- `public/app.js.sprint5.bak` は `.gitignore` に追加 or コミット対象外
- `.evaluator_tmp/` は `.gitignore` に追加（未追跡生成物）
