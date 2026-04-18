# Sprint 5 ストリーミング実装 — Evaluator 検証時間がボトルネックになった話

**日付**: 2026-04-18
**関連スプリント**: Sprint 5（タイピングアニメーション / SSE ストリーミング）

## やったこと

- `improvement-ideas.md` の「1. タイピングアニメーション（ストリーミング表示）」を Sprint 5 として実装
- Planner → Generator → Evaluator のフル agent pipeline を 1 周 + 差し戻し 1 周実施
- SSE (`text/event-stream`) エンドポイント `/api/consult/stream` 新設
- クライアント側 `fetch` + `ReadableStream` + AbortController によるタイムアウト制御
- `daily-log` スキル新規作成（本エントリはそのテスト運用も兼ねる）

## 今日の最大の気づき: Evaluator 検証時間がボトルネック

Sprint 5 は実装より**評価**に圧倒的に時間がかかった。実測:

| フェーズ | 所要時間 |
|---------|---------|
| Planner（SPEC追記） | 1分20秒 |
| Generator 初回（SSE実装） | **17分** |
| **Evaluator 初回** | **44分（不合格）** |
| Generator 修正 | 3分36秒 |
| **Evaluator 再評価** | **2時間37分（合格）** |

### なぜ Evaluator 初回 44 分かかったか

- サーバー側 `req.on("close")` 誤発火バグで、delta が 1 件もクライアントに届かず UI が永久ハング
- Evaluator は各モード × カテゴリ × テーマ の組み合わせを順番に検証する設計
- 1 パターン検証するたびに 90 秒以上のタイムアウトを待たされる
- 複数パターンで同じハングを踏むため時間が線形に積み上がる
- **結論**: バグで UI が死ぬと Evaluator は「応答を待つ」以外にやれることがなく、ひたすら待機

### なぜ Evaluator 再評価 2.6 時間かかったか

- 合格後の網羅検証で 27 パターンを実 Claude API × 実ブラウザで完走させた
- 1 応答あたり 3〜10 秒のストリーミング × モード 3 × テーマ 5 × 連続送信 × 回帰テスト
- Claude API の応答時間は SDK 側で吸収できないので素直に待つしかない
- `node server.js` + Playwright MCP + 実 API 呼び出しを直列に積んだ結果が実行時間

## 決めたこと

- **評価時間は削らない**。CLAUDE.md ルール「コード直読み禁止、必ず UI 操作」は遵守。網羅度を落とすと品質も落ちる
- **バグで UI ハングするケースはタイムアウトを短くする余地がある**。Evaluator 側の待機時間を制御できると初回の 44 分は短縮できるかもしれない（将来課題）
- **Generator 自己評価段階で curl のヘッダ確認だけで合格にしない**。実ブラウザで 1〜3 秒以内のタイピング開始まで目視してから進める（今回はここが甘かった）

## ハマったこと / 解決

### Critical: `req.on("close")` 誤発火でストリーム即死

- **症状**: SSE エンドポイントが chunked ヘッダまでは返すが、delta が 1 件もクライアントに届かない。`res.end()` も呼ばれずブラウザは永久ハング
- **原因**: Express で `req.on("close")` が「リクエストボディ受信完了」直後に発火する仕様。これを「クライアント切断」と誤判定し `clientAborted = true` セット → `for await` ループが最初のイベントで break
- **調査**: Anthropic SDK 単体では 7 イベント正常に返ることを確認（Express を介さず直呼び）。切り分けで Express 層が原因と特定
- **解決**:
  - `req.on("close")` → `res.on("close")` に置換 + `!res.writableEnded` ガード
  - `AbortController` を `client.messages.stream(..., { signal })` に渡して upstream もキャンセル可能に
  - `try/finally` で `!res.writableEnded` なら必ず `res.end()` 呼ぶ保証
  - クライアント側にも `AbortController` + 全体 60s / アイドル 20s タイムアウトを追加（サーバー異常時の UI 保険）

### MCP 切断

- 評価前に Playwright MCP が切れていた
- `/mcp` で再接続、Evaluator 再起動で復旧

## 変更ファイル

- `server.js` — `/api/consult/stream` 新設、AbortController、res.on("close")、safeWrite ヘルパー
- `public/app.js` — fetch + ReadableStream + AbortController + タイムアウト
- `public/style.css` — `.message-streaming-content::after` 点滅カーソル
- `specs/SPEC.md` — Sprint 5 追加（Feature 12, 13）
- `specs/progress.md` — Sprint 5 自己評価 + 不合格対応セクション
- `specs/evaluations/sprint-5.md` — 初回不合格レポート + 再評価合格レポート
- `.claude/skills/daily-log.md` — デイリーログスキル新設

## 次やること

- コミット前のレビュー（複数セッションぶんの変更が溜まっている）
- `improvement-ideas.md` の残り 9 案のうちどれを次スプリントで取るか検討
- Evaluator の検証タイムアウト短縮（ハング系バグ遭遇時の時間短縮）は将来の改善候補
