# Express 5 + Node.js v24 + PowerShell でサーバー即終了する問題

**日付**: 2026-04-15
**環境**: Windows 11 / Node.js v24.14.1 / PowerShell / Express 5.2.1

## 症状

`node server.js` を PowerShell で実行すると、`Server running at http://localhost:3000` と表示された直後にプロセスが終了する（exit code 0）。エラーは一切出ない。

## 調査過程

### 1. dotenv疑い → 無罪
`.env` のAPIキー読み込みを `node -e` で単体テスト。正常に読めていた。

### 2. プロセス終了原因の特定
`process.on("exit")` で終了コードを確認 → code 0（正常終了）。Node.js の event loop が空になりプロセスが自然終了していると判明。

### 3. http.createServer で回避試行 → 失敗
`app.listen()` を `http.createServer(app).listen()` に変更しても同じく即終了。Express 層が原因と絞り込み。

### 4. 素のhttpサーバーで検証 → 生存
Express を使わず `http.createServer` 単体で起動 → 正常にプロセスが待機し続けた。Express 5 が event loop を保持しないことが原因と特定。

### 5. Expressバージョン確認
`express@5.2.1` — 2024年リリースの新メジャーバージョン。Node.js v24 との組み合わせで event loop が空になるバグ（または非互換）。

## 解決策

**Express 5 → Express 4 にダウングレード**

```bash
npm install express@4
```

Express 4 の `app.listen()` は Node.js v24 + PowerShell でも正常に event loop を保持し、プロセスが待機し続ける。

## 補足対応

- 調査中に追加したデバッグログ（`process.on("exit")`, `console.log("API KEY exists:")` 等）を全削除
- `dotenv` v17 が起動時に `◇ injected env...` ログを出す → `require("dotenv").config({ quiet: true })` で抑制

## 教訓

- Express 5 は Node.js v24 との互換性に問題がある（2026-04時点）
- サーバーが「起動成功」ログを出しつつ即終了するケースは event loop が空になっている可能性が高い
- PowerShell では bash と異なり即座にプロンプトが戻るため、プロセス終了に気づきやすい
- 新しいメジャーバージョン同士の組み合わせ（Express 5 + Node 24）はリスクがある。安定版（Express 4）の選択が無難
