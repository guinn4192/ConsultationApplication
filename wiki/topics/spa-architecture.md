---
type: topic
sources:
  - C:\ConsultationApplication\public\js\main.js
  - C:\ConsultationApplication\public\js\state.js
  - C:\ConsultationApplication\public\js\api.js
  - C:\ConsultationApplication\public\js\router.js
updated: 2026-04-26
tags: [frontend, architecture, spa]
---

# spa-architecture

## 概要

`public/` のクライアント SPA 全体俯瞰。ビルドレス Vanilla ESM、4 軸（state / api / router / ui）の関心分離。各軸の詳細は個別 entity ページにあるので、本 topic は **境界とデータフロー** だけを記す。

## モジュールマップ

```
index.html  ──load──►  js/main.js (ESM)
                         │
                ┌────────┼────────────────────────────────┐
                ▼        ▼                                ▼
            state.js   router.js                    api.js
          (single src) (hash route)              (fetch + SSE)
                ▲                                     ▲
                │                                     │
                │ subscribe / call                    │ call
                │                                     │
        ui/shared.js    ui/chat.js   ui/emotion.js    │
        ui/summary.js   ui/history.js                 │
        ui/onboarding.js                              │
        ui/resume.js   ────────────────────────────► (DB resume etc.)
```

## 結合関係

| 結合方向 | パターン |
| --- | --- |
| ui → state | 関数呼び出し（`state.addUserMessage(...)` 等） |
| state → ui | **イベント購読**（`state.onMessageDone` / `state.onEmotionRecorded`）。state は ui を直接知らない |
| ui → api | 関数呼び出し |
| api → state | `state.getUserUuid()` を `apiFetch` 内で参照（ヘッダ自動付与） |
| router → main | リスナ集合経由で main の単一購読者に emit |
| main → router | `navigate()`, `start()` |

state が中央にあり、ui と api はそれぞれ state の読み書きのみで連携する。**ui 同士の直接呼び出しは最小限**（[[ui-summary]] と [[ui-history]] が [[ui-emotion]] の `EMOJI_CHOICES` を import する程度）。

## 画面 ⇄ ルート ⇄ UI モジュール ⇄ API ⇄ DB

| 画面 | ルート | UI モジュール | 主要 API 呼び出し | DB テーブル |
| --- | --- | --- | --- | --- |
| 相談 | `#/` | [[ui-shared]] / [[ui-chat]] / [[ui-emotion]] / [[ui-summary]] | `consultStream`（[[consult-stream-protocol]]）/ `createSession` / `closeSession` / `saveEmotion` | [[db-table-sessions]] / [[db-table-messages]] / [[db-table-emotion-records]] |
| オンボ | `#/onboarding` | [[ui-onboarding]] | `registerUser` | [[db-table-users]] |
| 履歴一覧 | `#/history` | [[ui-history]] | `listHistory` | [[db-table-sessions]] / [[db-table-messages]] |
| 履歴詳細 | `#/history/:id` | [[ui-history]] | `getHistoryDetail` | [[db-table-sessions]] / [[db-table-messages]] / [[db-table-emotion-records]] |
| 起動時の F21 | （ROOT に重畳） | [[ui-resume]] | `getResumableSession` / `closeSession` | 同上 |

## 起動・操作・終了の流れ

1. **起動**: [[frontend-bootstrap]] で UUID 検証 → resume 判定 → welcome
2. **操作**: 入力 → `state.addUserMessage` + `consultStream` → `state.markAssistantDone` → [[ui-emotion]] が描画
3. **感情**: `state.recordEmotion` → `state.onEmotionRecorded` 購読者（[[client-main]]）が `saveEmotion` で DB 永続化
4. **終了/切替**: 「新しい相談」→ [[ui-summary]] が中継 → [[client-main]] `performReset` が `closeSession` を fire-and-forget して `state.resetSession()`

## サーバ側との対比

サーバ側の正本は [[data-model]] と [[db-repo]]、ルータ群は [[route-user]] / [[route-sessions]] / [[route-emotions]] / [[route-history]]。クライアントは [[client-api]] が一手に対向するので、API 形状の変更は両サイドの **`client-api` ↔ 該当 route ページ** を同時更新する必要がある（[[wiki-linter]] の関心領域）。

なお `POST /api/consult/stream` は **src/ には存在せず** server.js または別ファイル（未取り込み）が提供する想定（[[consult-stream-protocol]] §概要）。

## 関連

- [[client-main]] / [[client-state]] / [[client-api]] / [[client-router]]
- [[frontend-bootstrap]] / [[consult-stream-protocol]] / [[emotion-trend-r6]] / [[theming-system]]
- [[data-model]] / [[user-identification]] / [[session-lifecycle]]
- [[analyses/client-vs-server-routing]] — フロント hash ルートとサーバ API ルートの比較

## 出典

- `C:\ConsultationApplication\public\js\main.js:1-440`
- `C:\ConsultationApplication\public\js\state.js:1-322`
- `C:\ConsultationApplication\public\js\api.js:1-300`
- `C:\ConsultationApplication\public\js\router.js:1-89`
