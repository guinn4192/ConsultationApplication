// ui/templateConfirm.js
// Sprint 9 / Feature 23: 既入力との衝突時の置き換え確認モーダル。
// DESIGN.md §1.8.4 / §4.7.2 / §7.9.6。
//
// 公開 API:
//   initTemplateConfirm(modalEl): DOM 配線を 1 度だけ行う
//   confirm(): Promise<boolean> — true=置き換える / false=キャンセル
//
// 設計方針:
//   - 既存 .summary-modal / .resume-modal の流儀を踏襲（カスタムモーダル / フォーカストラップ / Escape）
//   - キャンセル系（Escape / 背景クリック / 「キャンセル」ボタン）はすべて resolve(false) に集約
//   - 表示時のデフォルトフォーカスは「キャンセル」ボタン（誤 Enter で破壊しない保守的デフォルト）
//   - 表示前のフォーカス元を記憶し、閉じた後に戻す

let modalEl = null;
let cancelBtn = null;
let confirmBtn = null;
let backdropEl = null;
let pendingResolve = null;
let previousFocusEl = null;

/**
 * モーダル DOM をモジュールに紐付け、リスナを 1 度だけバインドする。
 * 想定 DOM 構造（DESIGN §1.8.4）:
 *   <div id="template-confirm-modal" hidden role="dialog" aria-modal="true">
 *     <div class="template-confirm-modal-backdrop"></div>
 *     <div class="template-confirm-modal-content">
 *       <h3 id="template-confirm-title">入力内容を置き換えますか？</h3>
 *       <p>現在入力中の内容は失われます。テンプレートで置き換えてもよろしいですか？</p>
 *       <div class="template-confirm-modal-actions">
 *         <button type="button" data-action="cancel">キャンセル</button>
 *         <button type="button" data-action="confirm">置き換える</button>
 *       </div>
 *     </div>
 *   </div>
 */
export function initTemplateConfirm(modal) {
  if (!modal) {
    console.warn("[templateConfirm] modal element not found; templates will fail-safe to cancel.");
    return;
  }
  modalEl = modal;
  cancelBtn = modalEl.querySelector('[data-action="cancel"]');
  confirmBtn = modalEl.querySelector('[data-action="confirm"]');
  backdropEl = modalEl.querySelector(".template-confirm-modal-backdrop");

  if (!cancelBtn || !confirmBtn) {
    console.warn("[templateConfirm] cancel/confirm buttons not found inside modal.");
    return;
  }

  cancelBtn.addEventListener("click", () => resolveAndClose(false));
  confirmBtn.addEventListener("click", () => resolveAndClose(true));

  // 背景クリック = キャンセル扱い
  if (backdropEl) {
    backdropEl.addEventListener("click", () => resolveAndClose(false));
  }
  // モーダル自体への直接クリック（backdrop 未取得時のフォールバック）
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      resolveAndClose(false);
    }
  });

  // Escape / Tab フォーカストラップ
  modalEl.addEventListener("keydown", onKeydown);
}

function onKeydown(e) {
  if (!modalEl || modalEl.hidden) return;
  if (e.key === "Escape") {
    e.preventDefault();
    resolveAndClose(false);
    return;
  }
  if (e.key === "Tab") {
    // フォーカストラップ: キャンセル ⇄ 置き換える の 2 ボタン間で循環
    const active = document.activeElement;
    if (e.shiftKey) {
      // 前方向: cancel → confirm に巻き戻す
      if (active === cancelBtn) {
        e.preventDefault();
        confirmBtn.focus();
      }
    } else {
      // 後方向: confirm → cancel に巻き戻す
      if (active === confirmBtn) {
        e.preventDefault();
        cancelBtn.focus();
      }
    }
  }
}

/**
 * モーダルを表示して resolve を待つ。
 * 連続呼び出しが起きた場合は、直前の Promise を false で解決してから新規受付する（多重表示防止）。
 */
export function confirm() {
  // モーダル DOM 未配線時はフェイルセーフでキャンセル相当
  if (!modalEl || !cancelBtn || !confirmBtn) {
    console.warn("[templateConfirm] not initialized; resolving false (fail-safe).");
    return Promise.resolve(false);
  }

  // 既に表示中の場合は前回を解決してから新規開く
  if (pendingResolve) {
    const prev = pendingResolve;
    pendingResolve = null;
    prev(false);
  }

  // 直前のフォーカス位置を保存（テンプレボタン等）
  previousFocusEl =
    document.activeElement && typeof document.activeElement.focus === "function"
      ? document.activeElement
      : null;

  return new Promise((resolve) => {
    pendingResolve = resolve;
    modalEl.hidden = false;
    modalEl.classList.add("is-open");
    modalEl.setAttribute("aria-hidden", "false");

    // デフォルトフォーカスは「キャンセル」（破壊しない側）
    // setTimeout で次フレームに回し、表示完了後に確実にフォーカスを当てる
    setTimeout(() => {
      if (cancelBtn) cancelBtn.focus();
    }, 0);
  });
}

function resolveAndClose(value) {
  if (!modalEl) return;
  modalEl.classList.remove("is-open");
  modalEl.hidden = true;
  modalEl.setAttribute("aria-hidden", "true");

  // フォーカスを呼び出し元に戻す（テンプレボタン等）
  if (previousFocusEl && document.body.contains(previousFocusEl)) {
    try {
      previousFocusEl.focus();
    } catch (_) {
      // フォーカス復元失敗は致命ではない
    }
  }
  previousFocusEl = null;

  if (pendingResolve) {
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve(!!value);
  }
}
