// ui/emotion.js — Feature 14: 5 段階絵文字セレクタ。
// R3 対策: message.state === "done" になった AI 回答に対してのみ描画する。
// state.onMessageDone を購読して、done 遷移時にセレクタを挿入する。

import { state } from "../state.js";
import { getMessageEl } from "./chat.js";

const EMOJI_CHOICES = [
  { value: 1, emoji: "😢", label: "とてもつらい" },
  { value: 2, emoji: "😟", label: "不安" },
  { value: 3, emoji: "😐", label: "ふつう" },
  { value: 4, emoji: "🙂", label: "前向き" },
  { value: 5, emoji: "😊", label: "とても前向き" },
];

/**
 * 指定 message id の直後に絵文字セレクタを挿入する。
 * 既に挿入済みの場合は何もしない（冪等）。
 * assistant 以外 / state != done の呼び出しは呼び側で制御する想定だが、安全側で判定も入れる。
 */
export function renderSelectorFor(messageId) {
  const messages = state.getMessages();
  const msg = messages.find((m) => m.id === messageId);
  if (!msg || msg.role !== "assistant" || msg.state !== "done") return;

  const msgEl = getMessageEl(messageId);
  if (!msgEl) return;

  // 既に挿入済みならスキップ
  if (msgEl.nextElementSibling && msgEl.nextElementSibling.classList.contains("emotion-selector")) {
    return;
  }

  const selector = document.createElement("div");
  selector.classList.add("emotion-selector");
  selector.dataset.forMessage = messageId;
  selector.setAttribute("role", "group");
  selector.setAttribute("aria-label", "今の気持ちを記録する");

  const label = document.createElement("span");
  label.classList.add("emotion-selector-label");
  label.textContent = "今の気持ちは？";
  selector.appendChild(label);

  const btnGroup = document.createElement("div");
  btnGroup.classList.add("emotion-buttons");

  const currentValue = state.getEmotionForMessage(messageId);

  for (const choice of EMOJI_CHOICES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("emotion-button");
    btn.dataset.value = String(choice.value);
    btn.setAttribute("aria-label", choice.label);
    btn.setAttribute("aria-pressed", currentValue === choice.value ? "true" : "false");
    btn.title = choice.label;
    btn.textContent = choice.emoji;
    if (currentValue === choice.value) {
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => {
      // 上書き / 切替
      if (state.getEmotionForMessage(messageId) === choice.value) {
        // 同じ値をもう一度押しても何もしない（解除仕様は SPEC に無いので保持）
        return;
      }
      state.recordEmotion(messageId, choice.value);
      // UI 更新: 兄弟ボタンの active を外して自分に付ける
      btnGroup.querySelectorAll(".emotion-button").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
    });
    btnGroup.appendChild(btn);
  }

  selector.appendChild(btnGroup);

  // message 要素の直後に挿入
  if (msgEl.parentNode) {
    msgEl.parentNode.insertBefore(selector, msgEl.nextSibling);
  }
}

/**
 * main.js から 1 度だけ呼ぶ。以降、全アシスタントメッセージの done 遷移で自動描画。
 */
export function initEmotionSelector() {
  state.onMessageDone((msg) => {
    if (msg.role === "assistant") {
      renderSelectorFor(msg.id);
    }
  });
}

export { EMOJI_CHOICES };
