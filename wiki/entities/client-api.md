---
type: entity
sources:
  - C:\ConsultationApplication\public\js\api.js
updated: 2026-04-26
tags: [frontend, api, fetch, sse]
---

# client-api

## 概要

`fetch` ラッパと REST エンドポイント関数群。すべて `apiFetch` を経由し、`x-user-uuid` を **localStorage の UUID から自動付与** する（[[user-identification]] のクライアント側）。SSE ストリームは個別実装（`apiFetch` を経由しない理由は [[consult-stream-protocol]] 参照）。

## 内部関数

### `apiFetch(input, init)` (`api.js:12-23`)

`fetch` の薄いラッパ。責務は **リクエスト整形のみ**（JSON パース/ステータス判定はしない、それは `handleJson` が担う）。後段で `Response` をそのまま受け取れるので、ステータスコードによる分岐（例: `getUser` の 404 特別扱い）が呼び出し側で書ける。

**1. ヘッダの正規化**
`init.headers` を `new Headers()` で包む。元の指定が plain object でも `Headers` でも `Map` でも統一的に扱え、以降は `.has()` / `.set()` で操作。

**2. `Content-Type` の自動補完** (`api.js:15-17`)
- 既に明示されていればそのまま
- **ボディが文字列**で `Content-Type` 未指定なら `application/json` を付与
- `FormData` / `Blob` 等は文字列でないので **付与されない** — ブラウザのデフォルト（`multipart/form-data` 等）に任せる

**3. `x-user-uuid` の自動付与** (`api.js:18-21`)
- 呼び出しごとに [[client-state]] `state.getUserUuid()` を **毎回読む**（localStorage 内部参照）。「別タブで登録された UUID が直後に使える」設計
- 呼び出し側が明示的に `x-user-uuid` を入れていれば **上書きしない**（`!headers.has(...)`）。テストで別ユーザーをシミュレートする余地
- サーバ側 [[user-identification]] のクロスチェック規約（ヘッダ vs クエリ不一致で 403）と整合

**例外: SSE は経由しない**
[[consult-stream-protocol]] の `consultStream`（`api.js:172-184`）は `apiFetch` を **経由せず** 手動 `fetch` する。SSE 本文を `body.getReader()` で逐次読むため、汎用 JSON 経路に乗せない。`x-user-uuid` は手動で同じ規約で付与する。

### `handleJson(res)` (`api.js:28-47`)

`Response` を「成功なら JSON / 失敗なら例外」の二択に正規化する統一ハンドラ。

```
res
 ├─ status === 204     → return null   (body を読まない)
 ├─ res.ok === false   → JSON なら body.error を抽出 → throw new Error(msg) [err.status 付き]
 │                       JSON でなければ "HTTP <status>" を throw
 └─ res.ok === true
       ├─ JSON         → return res.json()
       └─ 非 JSON      → return null
```

**ポイント**

- **204 を `null` に正規化**: [[route-sessions]] `GET /api/sessions/resumable` が「該当なし」を 204 で返す（`src/routes/sessions.js:73-74`）ため、呼び出し側は `null` チェックだけで済む。`res.json()` を 204 で呼ぶと例外になるので、先に弾く順番が重要。

- **失敗時のメッセージ抽出** (`api.js:31-42`): サーバ側ルータは一貫して `{ error: "<日本語>" }` を返す。JSON ならその `error` フィールドをユーザー向けメッセージに採用。JSON パース失敗は **try/catch で握り潰し**、`HTTP <status>` にフォールバック（壊れたレスポンスでもクラッシュしない）。

- **`err.status` を必ず付ける**: 呼び出し側でステータス分岐が可能。実例は [[frontend-bootstrap]] が `getUser` の 404 を見て `state.clearUser()` する経路（`main.js:226-233`）。

- **`Content-Type` の貪欲チェック**: `ct.includes("application/json")` で `application/json; charset=utf-8` のような派生型もマッチ。

### 責務分離と組み合わせ

```js
// 典型パターン
const res = await apiFetch("/api/...", { method, body });
return handleJson(res);
```

- `apiFetch` = **リクエスト** に関心（認証ヘッダ + Content-Type）
- `handleJson` = **レスポンス** に関心（ステータス→例外/値の二値化）

両方を1つにマージしなかった意図:
1. `getUser` のような **ステータス検査を挟みたい呼び出し** が綺麗に書ける
2. SSE のように `handleJson` を使わない経路でも `apiFetch` だけ流用できる柔軟性

### 軽微な冗長性: `getUser` の 404 独自 throw

`api.js:60-65` で 404 を **`handleJson` に渡す前に** 独自 throw する:

```js
if (res.status === 404) {
  const err = new Error("ユーザーが見つかりません。");
  err.status = 404;
  throw err;
}
return handleJson(res);
```

サーバが 404 で `{ error: "ユーザーが見つかりません。" }` を返す（`src/routes/user.js:48`）ので **`handleJson` 経由でも結果は同じはず**。差分は **メッセージ文字列がサーバ側に依存しない**（クライアントで固定文言を保証）。ディフェンシブコードとして残されているが、[[wiki-linter]] の lint 候補。

## エンドポイント関数（→ サーバ側）

| 関数 | メソッド + パス | サーバ側ルータ |
| --- | --- | --- |
| `registerUser(userName)` | `POST /api/user/register` | [[route-user]] |
| `getUser(uuid)` | `GET /api/user/:uuid` | [[route-user]]。404 時は `Error(status=404)` を throw |
| `createSession(clientSessionId)` | `POST /api/sessions` | [[route-sessions]]。`clientSessionId` 無し時は `undefined` を渡す |
| `closeSession(sessionId)` | `POST /api/sessions/:id/close` | [[route-sessions]] |
| `getResumableSession()` | `GET /api/sessions/resumable?uuid=...` | [[route-sessions]]。UUID 未取得時は `null` を即返し |
| `saveEmotion({sessionId,messageId,emojiValue})` | `POST /api/emotions` | [[route-emotions]] |
| `listHistory()` | `GET /api/history?uuid=...` | [[route-history]]。UUID 無しは `{sessions: []}` |
| `getHistoryDetail(sessionId)` | `GET /api/history/:sessionId` | [[route-history]] |

## SSE: `consultStream(payload, handlers)`

- 戻り値: `{ cancel(), done: Promise<void> }`
- 詳細プロトコルは [[consult-stream-protocol]]
- 二重タイムアウト
  - **overall** `OVERALL_TIMEOUT_MS = 60000` … 全体上限。発火で abort
  - **idle** `IDLE_TIMEOUT_MS = 20000` … data 受信ごとに `resetIdleTimer()`。発火で abort
  - 発火時は `timedOutReason` をユーザー向けメッセージに上書き
- パース: `\n\n` 区切りで rawEvent 単位、各行から `event:` と `data:` を抽出。`event` 既定値は `"message"`
- ハンドリング:
  - `event: delta` → `parsed.text` を `handlers.onDelta` に
  - `event: error` → `serverSignaledError` を保持して終端後に throw
  - `event: done` → `reply` / `assistantMessageId` / `persisted` を回収し `handlers.onDone` に
- フェイルセーフ: `streamStarted` が立たないまま読了 → 「AIからの回答を取得できませんでした」
- `apiFetch` を **使わず手動 `fetch`** する理由: SSE の本文ストリーム読みには `body.getReader()` を使うため、`apiFetch` の汎用 JSON 経路に乗せない（手動で `x-user-uuid` を付ける）

## 関連

- [[client-state]] — `getUserUuid` の参照先
- [[user-identification]] — クライアント側の自動付与規約
- [[consult-stream-protocol]] — SSE プロトコル詳細
- [[route-user]] / [[route-sessions]] / [[route-emotions]] / [[route-history]] — 対向サーバ

## 出典

- `C:\ConsultationApplication\public\js\api.js:12-300`
