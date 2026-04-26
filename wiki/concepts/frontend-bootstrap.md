---
type: concept
sources:
  - C:\ConsultationApplication\public\js\main.js
updated: 2026-04-26
tags: [frontend, bootstrap, lifecycle]
---

# frontend-bootstrap

## 概要

ページロードから初回画面表示までの起動シーケンス。[[client-main]] `bootstrap()` が中核。再開判定（Feature 21）を含む点が特徴。DESIGN.md §4.5 / §8.2 を参照。

## シーケンス

```
DOMContentLoaded
  └─ initShared / initChat / initEmotionSelector / initSummary / initOnboarding / initHistory / initResume
  └─ subscribeRoute(...) を 1 度登録
  └─ refreshHeaderUser()
  └─ bootstrap():
      ├─ uuid = state.getUserUuid()
      ├─ if (!uuid) → navigate(ONBOARDING) + startRouter() ⏹
      ├─ try { user = await getUser(uuid) }
      │    ├─ user.userName あれば setUserName + refreshHeaderUser
      │    └─ catch err.status === 404
      │           → state.clearUser() + navigate(ONBOARDING) + startRouter() ⏹
      │       catch other → console.warn のみで続行（オフライン耐性）
      ├─ try { payload = await getResumableSession() }
      │    ├─ payload.session あり:
      │    │    └─ 履歴/オンボ画面以外なら navigate(ROOT)
      │    │       startRouter()
      │    │       showResumeModal(payload) ⏹
      │    └─ catch → console.warn のみで続行
      └─ ハッシュ未指定なら navigate(ROOT) → startRouter() → showWelcomeMessage()
```

## ルーター購読のガード

`subscribeRoute(route => …)` は以下を毎回チェック:

```js
const uuid = state.getUserUuid();
if (!uuid && route.name !== "onboarding") {
  navigate(ROUTES.ONBOARDING);
  return;
}
```

つまり **ユーザー未登録でオンボ以外のルートに飛ぶと、強制的にオンボに戻される**。`#/history` を直接ブクマしていても適切にガードされる。

## 画面切替の単一責務

`subscribeRoute` 内の switch で `showOnboardingOnly` / `showHistoryListOnly` / `showHistoryDetailOnly` / `showChatOnly` のいずれかが呼ばれる。各 `*Only` ヘルパは:
- 他の画面を全部 hide
- モーダル（resume）を `dismiss`
- 担当画面のみ表示

これにより「画面の重複表示」を防ぐ。

## なぜ重要か

- **ローカル UUID の検証を必ず通す** ことで、サーバ側で削除済みのユーザーがクライアントだけ識別子を持ち続ける状態を解消（404 → クリア）。
- **F21 再開判定が welcome 表示より前** に走る。welcome を見せた後でモーダル、にはしない。
- ネットワークエラー耐性。`getUser` / `getResumableSession` の予期しないエラーは画面遷移に影響しない。

## 関連

- [[client-main]]
- [[client-state]] — UUID/userName 永続化
- [[client-api]] — `getUser`, `getResumableSession`
- [[client-router]] — `subscribe`, `navigate`, `start`
- [[ui-resume]] — 再開モーダル
- [[ui-onboarding]] — 初回登録
- [[session-lifecycle]] — F21 の意味論

## 出典

- `C:\ConsultationApplication\public\js\main.js:208-263`（bootstrap 本体）
- `C:\ConsultationApplication\public\js\main.js:182-205`（ルーター購読ガード）
