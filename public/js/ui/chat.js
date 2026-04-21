// ui/chat.js — メッセージ表示ロジック（Sprint 5 挙動を完全踏襲）。
// message DOM には data-message-id を持たせ、絵文字セレクタはこの id で紐付ける（R3）。

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
