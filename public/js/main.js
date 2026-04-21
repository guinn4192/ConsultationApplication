// main.js — エントリポイント。DOMContentLoaded で全モジュールを初期化。
// Sprint 6 時点では userUuid / sessionId はメモリのみ（DB なし）。

import { state } from "./state.js";
import { consultStream } from "./api.js";
import {
  initShared,
  updateCharCount,
  updateNewConsultationButton,
  setLoading,
  showError,
  clearError,
  resetModeAndCategoryUi,
  getRefs,
} from "./ui/shared.js";
import {
  initChat,
  scrollToBottom,
  showWelcomeMessage,
  removeWelcomeMessage,
  clearMessages,
  addMessage,
  addStreamingMessage,
  markStreamingDone,
} from "./ui/chat.js";
import { initEmotionSelector } from "./ui/emotion.js";
import { initSummary, open as openSummary } from "./ui/summary.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("consult-form");
  const input = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const errorMessage = document.getElementById("error-message");
  const chatMessages = document.getElementById("chat-messages");
  const newConsultationButton = document.getElementById("new-consultation-button");
  const categoryButtons = document.querySelectorAll(".category-button");
  const modeButtons = document.querySelectorAll(".mode-button");
  const modeDescription = document.getElementById("mode-description");
  const themeButtons = document.querySelectorAll(".theme-button");
  const charCount = document.getElementById("char-count");
  const summaryModal = document.getElementById("summary-modal");

  initChat(chatMessages);
  initShared({
    input,
    sendButton,
    newConsultationButton,
    charCount,
    errorMessage,
    themeButtons,
    modeButtons,
    categoryButtons,
    modeDescription,
    chatMessages,
  });
  initEmotionSelector();
  initSummary(summaryModal, {
    onResetClick: performReset,
  });

  // Sprint 5 の既定モード（default）を反映
  const defaultModeBtn = document.querySelector('.mode-button[data-mode="default"]');
  if (defaultModeBtn) defaultModeBtn.classList.add("active");
  if (modeDescription) modeDescription.textContent = "共感とアドバイスをバランスよく提供します";

  // ウェルカム
  showWelcomeMessage();

  // ---- 新しい相談を始める（Feature 6 + Feature 16） ----
  function performReset() {
    state.resetSession();
    resetModeAndCategoryUi();
    clearMessages();
    showWelcomeMessage();
    updateNewConsultationButton();
    updateCharCount();
    input.focus();
  }

  newConsultationButton.addEventListener("click", () => {
    if (state.isStreaming()) return;
    // Feature 16: 即リセットではなくサマリを先に開く
    openSummary();
  });

  // ---- 相談送信 ----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.isStreaming()) return;

    const message = input.value.trim();
    if (!message) {
      showError("相談内容を入力してください。");
      return;
    }
    if (input.value.length > 1000) {
      showError(`文字数が上限（1000文字）を超えています。`);
      return;
    }
    clearError();

    removeWelcomeMessage();

    // 初回送信時に sessionId を採番（Sprint 7 で DB PK として流用）
    state.ensureSessionId();

    // state に user message を push + DOM に描画
    const userId = state.addUserMessage(message);
    addMessage(message, "user", userId);

    input.value = "";
    updateCharCount();
    setLoading(true);
    updateNewConsultationButton();

    // assistant の streaming 枠と state を用意する箱（初回 delta 時点で埋める）
    let assistantId = null;
    let streamingEls = null; // { root, content }
    let accumulated = "";
    let errored = false;

    const lastEmotion = state.getLastEmotionValue(); // null の場合は送らない（中立扱い）
    const payload = {
      messages: state.getApiMessages(),
      category: state.getSelectedCategory(),
      mode: state.getSelectedMode(),
      // Sprint 6 追加（DESIGN §6.2）
      lastEmotion: lastEmotion == null ? null : lastEmotion,
      // Sprint 7 で実効化するが、ハーネスとして今から載せておく（サーバは Sprint 6 では無視）
      sessionId: state.getSessionId(),
      userUuid: state.getUserUuid(),
    };

    const handle = consultStream(payload, {
      onDelta(text) {
        if (!assistantId) {
          // 初回 delta: loading を AI 枠に切替
          setLoading(false);
          // ストリーミング中フラグ
          state.setStreaming(true);
          sendButton.disabled = true;
          input.disabled = true;
          newConsultationButton.disabled = true;

          assistantId = state.addStreamingAssistantMessage();
          streamingEls = addStreamingMessage(assistantId);
        }
        accumulated += text;
        state.updateStreamingAssistant(assistantId, accumulated);
        if (streamingEls && streamingEls.content) {
          streamingEls.content.textContent = accumulated;
          scrollToBottom();
        }
      },
      onDone(serverReply) {
        if (typeof serverReply === "string" && serverReply.length > 0) {
          accumulated = serverReply;
          if (streamingEls && streamingEls.content) {
            streamingEls.content.textContent = accumulated;
          }
        }
        if (streamingEls && streamingEls.root) {
          markStreamingDone(streamingEls.root);
        }
        if (assistantId) {
          // done 遷移 → emotion.js の onMessageDone 購読者がセレクタを描画する（R3）
          state.markAssistantDone(assistantId, accumulated);
        }
      },
      onError(err) {
        errored = true;
        // 部分描画があれば除去
        if (streamingEls && streamingEls.root && streamingEls.root.parentElement) {
          streamingEls.root.remove();
        }
        if (assistantId) {
          state.removeMessage(assistantId);
          assistantId = null;
        }
        addMessage(
          err.message || "通信エラーが発生しました。もう一度お試しください。",
          "error"
        );
      },
    });

    try {
      await handle.done;
    } finally {
      state.setStreaming(false);
      setLoading(false);
      input.disabled = false;
      updateNewConsultationButton();
      updateCharCount();
      // errored 時は何もしない（onError で処理済）
      void errored;
    }
  });

  // 初期ボタン状態
  updateNewConsultationButton();
  updateCharCount();
});
