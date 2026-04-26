---
type: concept
sources:
  - C:\ConsultationApplication\src\routes\sessions.js
  - C:\ConsultationApplication\src\routes\emotions.js
  - C:\ConsultationApplication\src\routes\history.js
updated: 2026-04-26
tags: [security, auth, convention]
---

# user-identification

## 概要

本アプリの認証は **`x-user-uuid` ヘッダ＝本人** という単一識別モデルである。パスワード等は持たない。複数ルータで識別UUIDの取り出し方が共通化されており、誤用しないようにここに規約を集約する。

## 取り出し優先順位（共通 `resolveUserUuid` 関数）

1. **`x-user-uuid` ヘッダ**（文字列なら `trim()`）
2. **ボディ `userUuid`**（[[route-sessions]] / [[route-emotions]] のみ）
3. **クエリ `?uuid=`**（[[route-sessions]] `resumable` / [[route-history]] のみ）
4. それ以外は `null` → ルータ層で `401`

[[route-user]] には適用されない（登録時にUUIDを発行、取得は `:uuid` パスパラメータ）。

## クロスチェック規約

ヘッダとクエリ（または body）の両方が来た場合は **不一致なら 403** を返す。これは `x-user-uuid` を持つ正規利用者が他人のUUIDを `?uuid=` で覗こうとする攻撃を防ぐ。

該当箇所:
- [[route-sessions]] `GET /api/sessions/resumable` — `src/routes/sessions.js:59-66`
- [[route-history]] `GET /api/history` — `src/routes/history.js:26-33`

[[route-emotions]] は body と照合しないが、`session.userUuid` 一致チェック（`403`）で代替している。

## クライアント側の自動付与

[[client-api]] の `apiFetch` ラッパが、`state.getUserUuid()` を毎回参照して **`x-user-uuid` ヘッダを自動付与** する（呼び出し側が明示してれば上書きしない）。SSE である `consultStream`（[[consult-stream-protocol]]）は `body.getReader()` のため `apiFetch` を経由せず手動で同じヘッダを付ける。クエリ `?uuid=` は [[client-api]] の `getResumableSession` / `listHistory` で別途付与され、サーバ側のクロスチェック規約と整合する。

## ルータ別パターン早見

| ルータ | ヘッダ | body | query | クロスチェック |
| --- | :-: | :-: | :-: | :-: |
| [[route-user]] `register` | — | — | — | — |
| [[route-user]] `:uuid` | — | — | — | — |
| [[route-sessions]] `POST /` | ✓ | ✓ | — | — |
| [[route-sessions]] `resumable` | ✓ | — | ✓ | ✓ |
| [[route-sessions]] `:id/close` | ✓ | ✓ | — | — |
| [[route-emotions]] `POST /` | ✓ | ✓ | — | — |
| [[route-history]] `GET /` | ✓ | — | ✓ | ✓ |
| [[route-history]] `:sessionId` | ✓ | ✓ | — | — |

## 関連

- [[route-sessions]] / [[route-emotions]] / [[route-history]] — 適用ルータ
- [[route-user]] — 例外（適用外）
- [[db-table-users]] — 識別子の所在
- [[client-api]] — クライアント側の自動付与
- [[consult-stream-protocol]] — SSE ルートでの手動付与

## 出典

- `C:\ConsultationApplication\src\routes\sessions.js:14-20`（`resolveUserUuid`）
- `C:\ConsultationApplication\src\routes\emotions.js:8-13`
- `C:\ConsultationApplication\src\routes\history.js:9-14`
