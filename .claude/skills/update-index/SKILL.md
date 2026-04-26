---
name: update-index
description: ユーザーが明示的に「index.mdを作って」「目次を更新して」「インデックスを再構築して」と指示したときだけ起動する。普段のingestやqueryでは絶対に呼ばれない、index.mdを更新する唯一の経路。entities/concepts/topics/analyses配下を全列挙してカテゴリ別に再構成する。
---

`C:\ConsultationApplication\wiki\index.md` を作成または再構築する。

**このスキルは `index.md` を更新する唯一の経路である**。`ingest`, `query`, `lint`, 通常の編集では `index.md` は触らない。ユーザーから明示的に指示があったときだけ実行する。

## 手順

1. `wiki/entities/`, `wiki/concepts/`, `wiki/topics/`, `wiki/analyses/` 配下の全 `*.md` を `Glob` で列挙する。
2. 各ページのフロントマター（`type`, `tags`, `updated`）と先頭の概要行を読む。
3. カテゴリごとにグルーピングし、以下のフォーマットで `wiki/index.md` を出力:

```markdown
# CAWiki Index

`C:\ConsultationApplication` をソースとするWikiの目次。各ページは `[[wikilink]]` で参照する。最終更新: <今日の日付>

## Entities

- [[entity-name]] — 1行サマリ — `updated: YYYY-MM-DD`
- ...

## Concepts

- [[concept-name]] — 1行サマリ — `updated: YYYY-MM-DD`
- ...

## Topics

- [[topic-name]] — 1行サマリ — `updated: YYYY-MM-DD`
- ...

## Analyses

- [[analyses/analysis-name]] — 1行サマリ — `updated: YYYY-MM-DD`
- ...
```

4. `wiki/log.md` に以下を追記:
   ```
   ## [<今日の日付>] index | rebuild on user request
   - 全 N ページをカテゴリ別に再構成
   ```

## 注意

- 1行サマリは各ページの「## 概要」直下、または本文1行目から取る。フロントマターの `description` フィールドがあればそちらを優先。
- ページが追加されたが `index.md` が更新されていない、という状態を許容する（ユーザー意思）。`index.md` の鮮度はユーザーが明示更新時にだけ保証される。
