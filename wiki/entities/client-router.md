---
type: entity
sources:
  - C:\ConsultationApplication\public\js\router.js
updated: 2026-04-26
tags: [frontend, router, spa]
---

# client-router

## 概要

ハッシュベースのミニマルな SPA ルータ。`location.hash` を購読してルートオブジェクト `{name, path, params}` を購読者へ emit する。

## ルート定義

| `name` | `hash` | パラメータ |
| --- | --- | --- |
| `root` | `#/` | — |
| `onboarding` | `#/onboarding` | — |
| `history` | `#/history` | — |
| `historyDetail` | `#/history/:id` | `params.sessionId` |
| `(unknown)` | 上記以外 | `fallback: true` → `navigate(ROOT)` |

`ROUTES` 定数: `ROOT = "#/"` / `ONBOARDING = "#/onboarding"` / `HISTORY = "#/history"`。

## API

- `parseHash(hash)` — `#!` プレフィックスや末尾スラッシュを正規化してルートオブジェクト化
- `navigate(hash)` — 同一ハッシュ時は `onHashChange()` を直接呼ぶ（emit を保証）
- `subscribe(cb)` — リスナ登録。戻り値で解除可
- `current()` — 現在ルート（無ければ `parseHash(location.hash)`）
- `start()` — 初期 emit。subscribe 後に呼ぶ前提

## 統合

`window.addEventListener("hashchange", onHashChange)` を **モジュール読込時に登録**。リスナ集合 `_listeners: Set` を介して [[client-main]] の単一購読者がルート切替に応じて画面切替を行う（[[frontend-bootstrap]] §ルーター購読）。

## 関連

- [[client-main]] — 唯一の購読者
- [[ui-onboarding]] / [[ui-history]] — ルートに対応する画面
- [[frontend-bootstrap]]
- [[analyses/client-vs-server-routing]] — クライアントルータとサーバ Router 群の比較

## 出典

- `C:\ConsultationApplication\public\js\router.js:9-89`
