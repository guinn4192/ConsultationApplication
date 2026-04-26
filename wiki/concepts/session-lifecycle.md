---
type: concept
sources:
  - C:\ConsultationApplication\src\db\schema.js
  - C:\ConsultationApplication\src\db\repo.js
  - C:\ConsultationApplication\src\routes\sessions.js
updated: 2026-04-26
tags: [sessions, lifecycle, idempotency]
---

# session-lifecycle

## 概要

[[db-table-sessions]] の状態遷移と、それを支える冪等性・自動 close ルールをまとめる。

## 状態

- **進行中**: `closed_at IS NULL`
- **終了**: `closed_at` に UTC ISO8601 の文字列が入る

## 遷移と関連エンドポイント

```
            POST /api/sessions
   (none) ───────────────────────► 進行中
                                     │
   GET /api/sessions/resumable       │ 当日かつ未close なら最新1件を返す
                                     │
            POST /api/sessions/:id/close
                                     ▼
                                   終了
```

### 作成（冪等）

[[route-sessions]] `POST /api/sessions` → [[db-repo]].`createSession` は `INSERT OR IGNORE` を発行。
- `clientSessionId` を受け取れば採用、無ければ `randomUUID()`。
- 二重送信されても新規行は作られず、`getSession` で同じ `startedAt` を返す。

### Resume

[[db-repo]].`getResumableSession` は以下を満たすセッションを最新1件返す:

```sql
WHERE user_uuid = ?
  AND closed_at IS NULL
  AND date(started_at) = date('now')
ORDER BY started_at DESC LIMIT 1
```

該当なしは [[route-sessions]] が `204` を返す（クライアントは「新規作成」に遷移する想定）。

### Close（冪等）

[[db-repo]].`closeSession` は `UPDATE ... WHERE id = ? AND user_uuid = ? AND closed_at IS NULL`。
- 所有者不一致 → `null`（ルータが `404`）
- すでに closed → `changes === 0` → `alreadyClosed: true` で `200` を返す

## Orphan close（起動時クリーンアップ）

[[db-schema]] の `initSchema` 末尾で:

```sql
UPDATE sessions
   SET closed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE closed_at IS NULL
   AND date(started_at) < date('now')
```

つまり **「前日以前に開かれて閉じられていない」セッションを起動時にすべて閉じる**。これにより resume の対象は常に「今日始まったもの」だけになり、ユーザーが離脱して数日後に戻っても古いセッションを意図せず再開してしまうことが無い。返り値 `{ orphanClosed: <件数> }` は呼び出し側でログ出力等に使える。

## クライアント側との対応

- **作成（fire-and-forget）**: [[client-main]] の form.submit 内で `state.ensureSessionId()` 後に [[client-api]] `createSession(currentSid)` を `await` せずに発射。失敗してもサーバが `INSERT OR IGNORE` で冪等なので致命ではない。
- **再開判定（起動時）**: [[frontend-bootstrap]] が `getResumableSession` を呼び、結果があれば [[ui-resume]] のモーダルを開く。「続きから」選択時は `state.setSessionId(server.id)` で **クライアント側の sessionId をサーバ ID に上書き** し、`state.restoreFromServer` で messages/emotions を注入。
- **新しく始める / 新しい相談**: [[client-main]] `performReset` または [[ui-resume]] `performFresh` で `closeSession` を呼ぶ（fire-and-forget）。失敗は次回起動時の orphan close で吸収される設計。

## 設計上の含意

- セッションの「日付境界」は **サーバー時刻の UTC**（`date('now')`）。クライアントタイムゾーンとずれうる点は要記憶。
- close 時刻は orphan close 経由でも UTC ISO8601 で記録される（自然な close と区別不可）。区別が必要になったら `closed_reason` 列を足す等の拡張を検討。

## 関連

- [[db-table-sessions]]
- [[db-schema]] — orphan close の実体
- [[route-sessions]]
- [[db-repo]]
- [[client-main]] / [[ui-resume]] — クライアント側のライフサイクル操作
- [[frontend-bootstrap]] — 起動時の再開判定

## 出典

- `C:\ConsultationApplication\src\db\schema.js:73-81`（orphan close）
- `C:\ConsultationApplication\src\db\repo.js:42-50`（resumable クエリ）
- `C:\ConsultationApplication\src\db\repo.js:35-39`（close クエリ）
