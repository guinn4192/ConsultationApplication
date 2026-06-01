// public/js/data/templates.js
// Sprint 9 / Feature 23: 相談テンプレート辞書（クライアントローカル静的辞書）
//
// 各テンプレートは以下の構造を持つ:
//   - id: 一意な識別子（DOM の data-template-id 属性および getTemplateById 参照キー）
//   - label: テンプレ選択ボタンに表示される短いテーマ名
//   - body: 入力欄に挿入される本文。必ず1箇所の "___"（U+005F × 3）プレースホルダーを含む
//   - placeholder: { start, end } — body 中の "___" の半開区間（end は1文字進めた値）
//                  body.slice(start, end) === "___" が起動時 __validate() で必ず成立すること
//   - recommendedCategory: 将来拡張用の推奨カテゴリ（Sprint 9 では UI に使用しない / DESIGN §1.8.5 / §7.9.3）
//
// 配置: DESIGN.md §1.8.2 (A) ESM 定数ファイル / §7.9.1 純粋関数化方針に従い、
//       export const で再代入不能。サーバ通信を伴わずモジュール読み込み時に静的解決される。

export const TEMPLATES = [
  {
    id: "workplace",
    label: "職場の人間関係",
    body: "職場の人間関係で悩んでいます。具体的には___",
    placeholder: { start: 20, end: 23 },
    recommendedCategory: "人間関係",
  },
  {
    id: "family",
    label: "家族との関係",
    body: "家族とのことで気持ちが落ち着きません。特に___",
    placeholder: { start: 21, end: 24 },
    recommendedCategory: "人間関係",
  },
  {
    id: "career",
    label: "進路・キャリア",
    body: "これからの進路について迷っています。今気になっているのは___",
    placeholder: { start: 28, end: 31 },
    recommendedCategory: "仕事",
  },
  {
    id: "health",
    label: "健康・体調の不安",
    body: "最近、体や心の調子が気になっています。具体的には___",
    placeholder: { start: 24, end: 27 },
    recommendedCategory: "健康",
  },
  {
    id: "vague",
    label: "漠然とした不安",
    body: "うまく言葉にできないのですが、なんとなく___が気になっています",
    placeholder: { start: 20, end: 23 },
    recommendedCategory: null,
  },
];

/**
 * id でテンプレートを引く純粋関数。
 * 未知 id は null を返す（DESIGN §7.9.6 エラーハンドリング）。
 */
export function getTemplateById(id) {
  if (typeof id !== "string" || id.length === 0) return null;
  return TEMPLATES.find((t) => t.id === id) || null;
}

/**
 * 起動時の辞書セルフチェック。
 * 全テンプレートで body.slice(start, end) === "___" を確認し、ミスを早期検出する。
 * 失敗時は throw（DESIGN §7.9.1 / §1.8.3）。
 */
export function __validate() {
  for (const t of TEMPLATES) {
    if (!t || typeof t.body !== "string") {
      throw new Error(`[templates] invalid entry: id=${t && t.id}`);
    }
    const p = t.placeholder;
    if (!p || typeof p.start !== "number" || typeof p.end !== "number") {
      throw new Error(`[templates] missing placeholder: id=${t.id}`);
    }
    if (t.body.slice(p.start, p.end) !== "___") {
      throw new Error(
        `[templates] placeholder mismatch: id=${t.id} ` +
          `expected "___" at [${p.start}, ${p.end}) but got ${JSON.stringify(
            t.body.slice(p.start, p.end)
          )}`
      );
    }
  }
  return true;
}

// モジュール読み込み時に 1 度だけ自己検証する（DESIGN.md §8.4 ステップ 1 末尾）。
// 失敗時はモジュール解決の段階で throw され、Generator/Evaluator が辞書編集ミスを即時検知できる。
(function selfCheck() {
  try {
    __validate();
  } catch (err) {
    // 開発中ミスのため console.error も併発。
    // 本番でも辞書はビルドに含まれるためここで失敗するならコード側の不整合。
    console.error("[templates] __validate failed:", err.message);
    throw err;
  }
})();
