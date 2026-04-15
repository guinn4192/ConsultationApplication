---
name: debug-server
description: サーバー起動・通信の問題を体系的に調査・切り分けするデバッグスキル。Evaluatorがテスト中に問題を発見した際に呼び出す。
---

# サーバーデバッグスキル

サーバーが期待通り動作しない場合の体系的な調査手順。

## いつ使うか

- サーバーが起動しない / 即終了する
- APIエンドポイントが応答しない
- 環境変数が読み込まれない
- ポート競合が発生する

## 調査手順

### Step 1: プロセス生存確認

サーバープロセスが生きているか確認する。

```bash
# ポートが使われているか確認
netstat -ano | grep ":3000"

# プロセスが返すレスポンスを確認
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

- レスポンスが返る → プロセスは生きてる。Step 3へ
- レスポンスが返らない → プロセスが死んでる。Step 2へ

### Step 2: 起動失敗の切り分け

#### 2a. ポート競合チェック
```bash
netstat -ano | grep ":3000"
# PIDが見つかれば別プロセスが占有 → taskkill /F /PID <PID>
```

#### 2b. プロセス即終了の調査
サーバーが起動ログを出した後に即終了する場合、event loopが空になっている可能性がある。

```bash
# exit codeとイベントを監視するコードを一時追加
process.on("exit", (code) => console.log("Exit code:", code));
process.on("uncaughtException", (err) => console.error("Uncaught:", err));
```

- exit code 0 → event loop空。フレームワークがlistenソケットを保持していない
- exit code 1 + エラー → エラーメッセージから原因特定

#### 2c. フレームワーク互換性チェック
Express等のフレームワークを使わず素のhttpサーバーで起動テスト。

```bash
node -e "require('http').createServer((req,res)=>{res.end('ok')}).listen(3000, ()=>console.log('alive'))"
```

- 素のhttpで生存 → フレームワークが原因。バージョンダウングレードを検討
- 素のhttpでも死亡 → Node.jsまたはOS環境の問題

### Step 3: APIエンドポイント調査

```bash
# GETリクエスト（静的ファイル配信）
curl -s http://localhost:3000

# POSTリクエスト（APIエンドポイント）
curl -s -X POST http://localhost:3000/api/consult \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
```

- 200 → 正常
- 400 → バリデーションエラー。リクエスト形式を確認
- 500 → サーバー内部エラー。レスポンスのerrorメッセージ確認

### Step 4: 環境変数の調査

```bash
# サーバー外から直接確認
node -e "require('dotenv').config(); console.log('KEY exists:', !!process.env.ANTHROPIC_API_KEY)"
```

- exists: true → dotenvは正常。サーバー内の参照箇所を確認
- exists: false → `.env` ファイルの場所・フォーマット確認

`.env` のよくある問題:
- ダブルクォートの有無（dotenvバージョンによる）
- ファイルがプロジェクトルートにない
- BOM付きUTF-8

### Step 5: ログ注入による内部状態確認

問題のある箇所に一時的にconsole.logを入れて内部状態を確認する。

```js
// エンドポイント内
console.log("apiKey exists:", !!process.env.ANTHROPIC_API_KEY);
console.log("request body:", JSON.stringify(req.body));
```

**調査完了後は必ずデバッグログを削除すること。**

## 過去の事例

### Express 5 + Node.js v24 + PowerShell (2026-04-15)
- **症状**: `app.listen()` 後にプロセスがexit code 0で即終了
- **原因**: Express 5.2.1がNode.js v24でevent loopを保持しない
- **解決**: Express 4にダウングレード
- **詳細**: `diary/2026-04-15_express5-node24-powershell-crash.md`
