---
name: query
description: ユーザーがCAWikiに対して質問を投げたとき（「Wikiで〜について教えて」「〜はどこに書いてある？」「〜の関係を整理して」等）に起動する。Wikiページを検索・読込・合成して回答し、新しい合成・比較・深堀りを含む場合はanalyses/へのfiling backをユーザーに提案する。
---

CAWiki（`C:\ConsultationApplication\wiki`）に対する質問に回答する。

## 手順

1. **Wiki内検索**
   - `Grep` / `Glob` で関連ページを探す。
   - `index.md` が存在すればナビゲーション用に参照する（無くても可）。

2. **関連ページの読み込み**
   - 候補ページを `Read` し、必要なら出典ソース（`C:\ConsultationApplication\...`）も補助的に確認する。

3. **回答の合成**
   - Wikiページへの `[[wikilink]]`
   - 出典ソースの絶対パス + 行番号（例: `src/routes/foo.js:42`）
   - 矛盾や情報不足があれば明示する。

4. **Filing back の提案**
   - 回答が **新しい合成・比較・深堀り** を含む場合、`analyses/` への新規ページ化をユーザーに提案する。
   - 自動では作らない。同意を得てから書く。
   - filing back する場合のフロントマター `type: analysis` とし、出典に元ソースを列挙する。

5. **ログ追記**
   - `wiki/log.md` に以下を追記:
     ```
     ## [<今日の日付>] query | <質問の短い要約>
     - 参照ページ: [[page-1]], [[page-2]]
     - filed-back: [[analyses/...]]（作成した場合のみ）
     ```

## 注意

- `.env` 等の禁止ファイルには絶対に触れない。
- `index.md` は本スキルでも更新しない。
