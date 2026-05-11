// ui/chat.js — メッセージ表示ロジック（Sprint 5 挙動を完全踏襲）。
// message DOM には data-message-id を持たせ、絵文字セレクタはこの id で紐付ける（R3）。
//
// Sprint 8 / Feature 22:
//   既存関数（showWelcomeMessage / addMessage / clearMessages 等）は一切変更しない。
//   showDailyMessage / removeDailyMessage を追加 export のみで対応する（§7.8.5 / §8.3）。

import { getDailyMessage } from "../dailyMessage.js";

let chatMessagesEl = null;

export function initChat(chatMessages) {
  chatMessagesEl = chatMessages;
}

export function scrollToBottom() {
  if (!chatMessagesEl) return;
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

export function showWelcomeMessage() {
  if (!chatMessagesEl) return;
  const div = document.createElement("div");
  div.id = "welcome-message";
  div.classList.add("message", "message-welcome");

  const label = document.createElement("span");
  label.classList.add("message-label");
  label.textContent = "AIカウンセラー";
  div.appendChild(label);

  const content = document.createElement("span");
  content.textContent =
    "こんにちは！「こころの相談室」へようこそ。\n\n" +
    "私はあなたの悩みに寄り添うAIカウンセラーです。\n" +
    "仕事、人間関係、健康、日常生活など、どんなことでもお気軽にご相談ください。\n\n" +
    "【使い方のヒント】\n" +
    "・下のカテゴリを選ぶと、より的確なアドバイスが受けられます\n" +
    "・テキスト欄にお悩みを入力して「送信する」を押してください\n" +
    "・続けて質問すると、会話の流れを踏まえて回答します\n" +
    "・AI回答の下の絵文字で今の気持ちを記録できます\n" +
    "・新しい話題で相談したいときは「新しい相談を始める」を押してください";
  div.appendChild(content);

  chatMessagesEl.appendChild(div);
  scrollToBottom();
}

export function removeWelcomeMessage() {
  const w = document.getElementById("welcome-message");
  if (w) w.remove();
}

export function clearMessages() {
  if (!chatMessagesEl) return;
  chatMessagesEl.innerHTML = "";
}

/**
 * 通常メッセージ（確定済）を追加。
 * @param {string} text
 * @param {"user"|"ai"|"error"} type
 * @param {string|null} id - message id（絵文字セレクタ紐付け用）
 * @returns {HTMLElement} message root div
 */
export function addMessage(text, type, id = null) {
  if (!chatMessagesEl) return null;
  const div = document.createElement("div");
  div.classList.add("message");
  if (id) div.dataset.messageId = id;

  if (type === "user") {
    div.classList.add("message-user");
    const label = document.createElement("span");
    label.classList.add("message-label");
    label.textContent = "あなた";
    div.appendChild(label);
  } else if (type === "ai") {
    div.classList.add("message-ai");
    const label = document.createElement("span");
    label.classList.add("message-label");
    label.textContent = "AIカウンセラー";
    div.appendChild(label);
  } else if (type === "error") {
    div.classList.add("message-error");
  }

  const content = document.createElement("span");
  content.textContent = text;
  div.appendChild(content);

  chatMessagesEl.appendChild(div);
  scrollToBottom();
  return div;
}

/**
 * ストリーミング用 AI メッセージ枠を作成。content span を返す。
 * @param {string} id - message id
 */
export function addStreamingMessage(id) {
  if (!chatMessagesEl) return null;
  const div = document.createElement("div");
  div.classList.add("message", "message-ai", "message-streaming");
  if (id) div.dataset.messageId = id;

  const label = document.createElement("span");
  label.classList.add("message-label");
  label.textContent = "AIカウンセラー";
  div.appendChild(label);

  const content = document.createElement("span");
  content.classList.add("message-streaming-content");
  content.textContent = "";
  div.appendChild(content);

  chatMessagesEl.appendChild(div);
  scrollToBottom();
  return { root: div, content };
}

/**
 * ストリーミング完了フラグ。カーソル点滅を止める。
 */
export function markStreamingDone(rootDiv) {
  if (rootDiv) rootDiv.classList.add("streaming-done");
}

/**
 * 指定 id の message 要素を返す（絵文字セレクタの挿入先を見つけるため）。
 */
export function getMessageEl(id) {
  if (!chatMessagesEl) return null;
  return chatMessagesEl.querySelector(`[data-message-id="${CSS.escape(id)}"]`);
}

// ============================================================
// Sprint 8 / Feature 22: 日替わりの一言メッセージ
// ============================================================

/**
 * 既存の「今日のひとこと」DOM を全て削除する（冪等性のための事前クリーンアップ）。
 * `showDailyMessage()` 内部から最初に呼ばれる。
 * 既存メッセージや welcome に影響しないよう、`[data-daily-message]` 属性で限定する。
 */
export function removeDailyMessage() {
  if (!chatMessagesEl) return;
  const existing = chatMessagesEl.querySelectorAll("[data-daily-message]");
  existing.forEach((el) => el.remove());
}

/**
 * 「今日のひとこと」要素をチャットエリアに描画する。
 *
 * - DESIGN §4.6.1 / §4.6.2 / §8.3 に従い、`showWelcomeMessage()` の直前に呼ばれる前提。
 *   その結果 DOM 上の並びは「[今日のひとこと] → [ウェルカム]」となる。
 * - 冪等性: 先頭で `removeDailyMessage()` を呼ぶため、複数回呼んでも 1 要素のみ残る（§7.8.2）。
 * - DOM 識別属性: `data-daily-message` / `data-weekday` / `data-season` を必ず付与（Evaluator 用）。
 * - エラー耐性: `chatMessagesEl` 未取得時は `console.warn` のみで黙って中断（§7.8.3 / 既存非破壊）。
 *
 * @param {Date} [date=new Date()] - Date 注入可能（Evaluator が page.clock.install で固定する）
 */
export function showDailyMessage(date = new Date()) {
  if (!chatMessagesEl) {
    // 既存機能（ウェルカム表示等）の阻害を絶対に起こさないため、warn のみで return
    console.warn(
      "[dailyMessage] chatMessagesEl is not initialized; skip showDailyMessage()"
    );
    return null;
  }

  // 冪等性
  removeDailyMessage();

  const info = getDailyMessage(date);

  const root = document.createElement("div");
  root.classList.add("daily-message");
  root.setAttribute("data-daily-message", "");
  root.setAttribute("data-weekday", String(info.weekdayIndex));
  root.setAttribute("data-season", info.season);
  root.setAttribute("role", "note");
  root.setAttribute(
    "aria-label",
    `今日のひとこと（${info.weekdayLabel}・${info.seasonLabel}）`
  );

  const labelEl = document.createElement("span");
  labelEl.classList.add("daily-message-label");
  labelEl.textContent = "今日のひとこと";
  root.appendChild(labelEl);

  const metaEl = document.createElement("span");
  metaEl.classList.add("daily-message-meta");
  metaEl.textContent = `${info.weekdayLabel}・${info.seasonLabel}`;
  root.appendChild(metaEl);

  const textEl = document.createElement("span");
  textEl.classList.add("daily-message-text");
  textEl.textContent = info.message;
  root.appendChild(textEl);

  chatMessagesEl.appendChild(root);
  // scrollToBottom は呼ばない（初期表示の冒頭に出る要素なので、画面冒頭を維持する）
  return root;
}
