// ui/resume.js — Feature 21: 中断した会話の再開モーダル。
// DESIGN.md §4.5 / §7.6。

import { state } from "../state.js";
import { closeSession } from "../api.js";
import {
  clearMessages,
  addMessage,
  removeWelcomeMessage,
} from "./chat.js";
import { renderSelectorFor } from "./emotion.js";

let modalEl = null;
let onResumeCb = null;
let onFreshStartCb = null;

export function initResume(modal, { onResume, onFreshStart }) {
  modalEl = modal;
  onResumeCb = onResume;
  onFreshStartCb = onFreshStart;
}

/**
 * サーバから受け取った payload（{session, messages, emotions}）を受け取って
 * 再開モーダルを開く。
 */
export function showModal(payload) {
  if (!modalEl) return;
  const { session, messages = [], emotions = [] } = payload || {};

  modalEl.innerHTML = "";
  modalEl.hidden = false;
  modalEl.classList.add("is-open");
  modalEl.setAttribute("aria-hidden", "false");

  const card = document.createElement("div");
  card.classList.add("resume-card");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "resume-title");

  const title = document.createElement("h2");
  title.id = "resume-title";
  title.classList.add("resume-title");
  title.textContent = "前回の続きから？";
  card.appendChild(title);

  const desc = document.createElement("p");
  desc.classList.add("resume-description");
  const preview =
    messages && messages.length > 0
      ? messages[0].content.length > 40
        ? messages[0].content.slice(0, 40) + "…"
        : messages[0].content
      : "";
  desc.textContent =
    "今日、まだ続いている相談が見つかりました。\n" +
    "続きから話しますか？" +
    (preview ? `\n\n（前回のはじめ: ${preview}）` : "");
  card.appendChild(desc);

  const meta = document.createElement("p");
  meta.classList.add("resume-meta");
  const count = messages.length;
  meta.textContent = `やり取り ${count} 件${emotions.length > 0 ? ` / 気分記録 ${emotions.length} 件` : ""}`;
  card.appendChild(meta);

  const actions = document.createElement("div");
  actions.classList.add("resume-actions");

  const resumeBtn = document.createElement("button");
  resumeBtn.type = "button";
  resumeBtn.classList.add("resume-button", "resume-button-resume");
  resumeBtn.textContent = "前回の続きから再開する";
  resumeBtn.addEventListener("click", async () => {
    resumeBtn.disabled = true;
    freshBtn.disabled = true;
    try {
      await performResume({ session, messages, emotions });
    } finally {
      dismiss();
      if (typeof onResumeCb === "function") onResumeCb();
    }
  });
  actions.appendChild(resumeBtn);

  const freshBtn = document.createElement("button");
  freshBtn.type = "button";
  freshBtn.classList.add("resume-button", "resume-button-fresh");
  freshBtn.textContent = "新しく始める";
  freshBtn.addEventListener("click", async () => {
    resumeBtn.disabled = true;
    freshBtn.disabled = true;
    try {
      await performFresh(session);
    } finally {
      dismiss();
      if (typeof onFreshStartCb === "function") onFreshStartCb();
    }
  });
  actions.appendChild(freshBtn);

  card.appendChild(actions);
  modalEl.appendChild(card);

  setTimeout(() => resumeBtn.focus(), 0);
}

/**
 * 「前回の続きから」選択時の復元処理（§7.6）。
 */
async function performResume({ session, messages, emotions }) {
  // 1. sessionId を完全に上書き
  state.setSessionId(session.id);

  // 2. state に丸ごと注入
  state.restoreFromServer({
    sessionId: session.id,
    messages,
    emotions,
  });

  // 3. 画面のウェルカムを消して、即時描画（ストリーミングなし）
  clearMessages();
  removeWelcomeMessage();

  for (const m of messages) {
    const type = m.role === "user" ? "user" : "ai";
    addMessage(m.content, type, m.id);
    if (m.role === "assistant") {
      // state を "done" にした上で絵文字セレクタを直接描画（state.onMessageDone を経由しない）
      // restoreFromServer で state は既に "done" 扱い
      renderSelectorFor(m.id);
    }
  }
  // 感情記録の .active は renderSelectorFor 内で state.getEmotionForMessage を参照するため、
  // messages 描画時点で復元される。追加操作は不要。
}

/**
 * 「新しく始める」選択時の処理（§7.6）。
 * 既存セッションを close（冪等）→ state を初期化。
 */
async function performFresh(session) {
  try {
    if (session && session.id) {
      await closeSession(session.id);
    }
  } catch (_) {
    // 冪等なので失敗してもフローは続行
  }
  state.resetSession();
}

export function dismiss() {
  if (!modalEl) return;
  modalEl.hidden = true;
  modalEl.classList.remove("is-open");
  modalEl.setAttribute("aria-hidden", "true");
  modalEl.innerHTML = "";
}
