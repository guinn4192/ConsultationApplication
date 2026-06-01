// ui/templates.js
// Sprint 9 / Feature 23: 相談テンプレートの選択 UI 初期化と挿入ロジック。
// DESIGN.md §4.7.1〜§4.7.3 / §7.9.1〜§7.9.7 / 付録 D。
//
// 公開 API:
//   initTemplates({ container, input, getIsStreaming, confirmReplace })
//     - container: .template-section （配下に .template-button が複数存在）
//     - input: #message-input （textarea）
//     - getIsStreaming: () => boolean  （state.isStreaming() を渡す）
//     - confirmReplace: () => Promise<boolean>  （templateConfirm.confirm を渡す）
//
// 設計方針（厳守事項）:
//   - state.setSelectedCategory() / .category-button.active 操作を一切呼ばない（§7.9.3 / R13）
//   - input.value 代入直後に必ず input イベントを dispatchEvent（§7.9.2 / R12）
//   - ストリーミング中（getIsStreaming() === true）は何もせず early return（§7.9.4）
//   - lastInsertedBody でテンプレ A→B 切替時の確認モーダル不要を判定（§8.4 ステップ 6 #5 補足）

import { getTemplateById } from "../data/templates.js";

// モジュールスコープ: 直前に挿入したテンプレ本文。
// input.value === lastInsertedBody であれば「ユーザーが手入力していない」とみなし、
// 確認モーダルをスキップしてテンプレ間切り替えを許可する。
let lastInsertedBody = null;

let _input = null;
let _getIsStreaming = null;
let _confirmReplace = null;

/**
 * 初期化。.template-button をすべてバインドする。
 * 静的 DOM 配置のため起動時 1 度だけ呼べばよい（再描画の必要なし）。
 */
export function initTemplates({ container, input, getIsStreaming, confirmReplace } = {}) {
  if (!input) {
    console.warn("[templates] input element not found; aborting init.");
    return;
  }
  _input = input;
  _getIsStreaming = typeof getIsStreaming === "function" ? getIsStreaming : () => false;
  _confirmReplace =
    typeof confirmReplace === "function" ? confirmReplace : () => Promise.resolve(false);

  const root = container || document.querySelector(".template-section");
  if (!root) {
    console.warn("[templates] .template-section not found; templates UI inert.");
    return;
  }

  // 個々の .template-button をすべて拾ってバインド
  const buttons = root.querySelectorAll(".template-button");
  if (buttons.length === 0) {
    console.warn("[templates] no .template-button found inside container.");
    return;
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.dataset.templateId;
      if (!id) return;
      // async でも await されない（click ハンドラは結果を待たない）が、
      // insertTemplate 内部で確認モーダルの完了を待つため問題ない。
      insertTemplate(id).catch((err) => {
        console.warn("[templates] insertTemplate failed:", err && err.message);
      });
    });
  });
}

/**
 * テンプレートを入力欄に挿入する。
 * DESIGN §4.7.1 / §4.7.2 / §7.9.2 のシーケンスを忠実に再現。
 *
 * 内部呼び出し時に options でテスト用に input / confirmFn を上書き可能だが、
 * 通常は initTemplates() で渡された参照を使う。
 */
export async function insertTemplate(templateId, options = {}) {
  const input = options.input || _input;
  const confirmFn = options.confirmFn || _confirmReplace;
  const getIsStreaming = options.getIsStreaming || _getIsStreaming || (() => false);

  // R12 派生フェイルセーフ: 必須参照が無ければ無音で抜ける
  if (!input) {
    console.warn("[templates] #message-input not available; abort insert.");
    return;
  }

  // ストリーミング中は挿入しない（§7.9.4 / R12 外の派生対策）
  if (getIsStreaming()) {
    return;
  }

  const template = getTemplateById(templateId);
  if (!template) {
    // 未知 ID は黙って無視（§7.9.6 / R12 派生）
    return;
  }

  // 既入力の判定:
  //  - trim() で完全な空欄は許可（空欄時は確認なし / 受入基準 #13）
  //  - 直前に挿入したテンプレ本文と完全一致 → ユーザーが手入力していない →
  //    確認なしで切替（受入基準 #14 / §8.4 ステップ 6 #5 補足）
  const current = input.value;
  const isEmpty = current.trim().length === 0;
  const matchesLastInserted =
    lastInsertedBody !== null && current === lastInsertedBody;

  if (!isEmpty && !matchesLastInserted) {
    // ユーザーの手入力あり → 確認モーダルへ
    const ok = await confirmFn();
    if (!ok) {
      // キャンセル選択: input.value は変更しない（受入基準 #11）
      return;
    }
  }

  // ---- 挿入処理（順序厳守 / §7.9.2）----
  // 1. value 書き換え
  input.value = template.body;

  // 2. input イベント明示発火（R12 対策: 文字数カウンタ / 送信ボタン活性化 / 既存リスナ連動）
  input.dispatchEvent(new Event("input", { bubbles: true }));

  // 3. textarea にフォーカス（setSelectionRange の前提）
  try {
    input.focus();
  } catch (_) {
    // テスト環境等での失敗は致命ではない
  }

  // 4. 穴埋め部 "___" を範囲選択（次のキー入力で自動上書き / 受入基準 #5 / #6）
  try {
    if (typeof input.setSelectionRange === "function") {
      input.setSelectionRange(template.placeholder.start, template.placeholder.end);
    }
  } catch (_) {
    // 非対応環境では選択状態にできないがフォーカスは当たっているため致命ではない
  }

  // 5. 直前挿入記憶を更新（§8.4 ステップ 6 #5 補足）
  lastInsertedBody = template.body;

  // ※ state.setSelectedCategory() / .category-button.active を一切呼ばない（§7.9.3 / R13）
  // ※ state や localStorage に書き込まない（テンプレ機能は state を持たない）
}

/**
 * テスト/デバッグ用: モジュールスコープの直前挿入記憶を取得。
 * Evaluator が必要なら window 経由で読み取れるが、Sprint 9 では公開しない。
 */
export function __getLastInsertedBody() {
  return lastInsertedBody;
}

/**
 * テスト用リセット（通常呼ばない）。
 */
export function __resetLastInsertedBody() {
  lastInsertedBody = null;
}
