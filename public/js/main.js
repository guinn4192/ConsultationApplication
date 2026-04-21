// main.js — エントリポイント。DOMContentLoaded で全モジュールを初期化。
// Sprint 7: オンボーディング / 履歴 / 再開モーダル / DB 永続化を束ねる。

import { state } from "./state.js";
import {
  consultStream,
  getUser,
  createSession,
  getResumableSession,
  saveEmotion,
} from "./api.js";
import {
  initShared,
  updateCharCount,
  updateNewConsultationButton,
  setLoading,
  showError,
  clearError,
  resetModeAndCategoryUi,
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
import { initOnboarding, show as showOnboarding, hide as hideOnboarding } from "./ui/onboarding.js";
import { initHistory, showList as showHistoryList, showDetail as showHistoryDetail, hide as hideHistory } from "./ui/history.js";
import { initResume, showModal as showResumeModal, dismiss as dismissResumeModal } from "./ui/resume.js";
import { subscribe as subscribeRoute, start as startRouter, navigate, ROUTES } from "./router.js";

document.addEventListener("DOMContentLoaded", () => {
  // ---- DOM refs ----
  const form = document.getElementById("consult-form");
  const input = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const errorMessage = document.getElementById("error-message");
  const chatMessages = document.getElementById("chat-messages");
  const chatContainer = document.getElementById("chat-container");
  const newConsultationButton = document.getElementById("new-consultation-button");
  const categoryButtons = document.querySelectorAll(".category-button");
  const modeButtons = document.querySelectorAll(".mode-button");
  const modeDescription = document.getElementById("mode-description");
  const themeButtons = document.querySelectorAll(".theme-button");
  const charCount = document.getElementById("char-count");
  const summaryModal = document.getElementById("summary-modal");
  const resumeModal = document.getElementById("resume-modal");
  const onboardingScreen = document.getElementById("onboarding-screen");
  const historyScreen = document.getElementById("history-screen");
  const headerUserName = document.getElementById("header-user-name");
  const headerHistoryLink = document.getElementById("header-history-link");

  // ---- 初期化 ----
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
  initOnboarding(onboardingScreen, {
    onComplete: async () => {
      hideOnboarding();
      refreshHeaderUser();
      // オンボ直後は resumable を問わず通常フローへ（SPEC F21 初回訪問時はモーダル表示しない）
      navigate(ROUTES.ROOT);
      showWelcomeMessage();
    },
  });
  initHistory(historyScreen);
  initResume(resumeModal, {
    onResume: () => {
      // 再開完了後: 相談画面表示
      navigate(ROUTES.ROOT);
      updateNewConsultationButton();
    },
    onFreshStart: () => {
      navigate(ROUTES.ROOT);
      clearMessages();
      showWelcomeMessage();
      resetModeAndCategoryUi();
      updateNewConsultationButton();
    },
  });

  // Sprint 5 の既定モード（default）を反映
  const defaultModeBtn = document.querySelector('.mode-button[data-mode="default"]');
  if (defaultModeBtn) defaultModeBtn.classList.add("active");
  if (modeDescription) modeDescription.textContent = "共感とアドバイスをバランスよく提供します";

  // 感情記録のリスナ（Sprint 7: DB に書く）
  state.onEmotionRecorded(async ({ messageId, emojiValue, sessionId }) => {
    const sid = sessionId || state.getSessionId();
    const uuid = state.getUserUuid();
    if (!uuid || !sid) return; // 未識別 or セッション未開始ならスキップ
    try {
      await saveEmotion({ sessionId: sid, messageId, emojiValue });
    } catch (err) {
      // DB 失敗時は UI は維持しつつエラー通知
      console.warn("saveEmotion failed:", err.message);
      showPersistError("気分の記録の保存に失敗しました。");
    }
  });

  // ---- トースト（DB 書き込み失敗時） ----
  let persistErrorTimer = null;
  function showPersistError(msg) {
    let toast = document.getElementById("persist-error-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "persist-error-toast";
      toast.classList.add("persist-error-toast");
      toast.setAttribute("role", "alert");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("is-visible");
    if (persistErrorTimer) clearTimeout(persistErrorTimer);
    persistErrorTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 4000);
  }

  // ---- ヘッダ: ユーザー名表示 + 履歴リンク制御 ----
  function refreshHeaderUser() {
    const name = state.getUserName();
    const uuid = state.getUserUuid();
    if (name) {
      headerUserName.textContent = `ようこそ、${name}さん`;
      headerUserName.hidden = false;
    } else {
      headerUserName.hidden = true;
      headerUserName.textContent = "";
    }
    headerHistoryLink.hidden = !uuid;
  }

  // ---- 画面切り替え ----
  function showChatOnly() {
    hideOnboarding();
    hideHistory();
    dismissResumeModal();
    chatContainer.hidden = false;
  }
  function showOnboardingOnly() {
    chatContainer.hidden = true;
    hideHistory();
    dismissResumeModal();
    showOnboarding();
  }
  function showHistoryListOnly() {
    chatContainer.hidden = true;
    hideOnboarding();
    dismissResumeModal();
    showHistoryList();
  }
  function showHistoryDetailOnly(sessionId) {
    chatContainer.hidden = true;
    hideOnboarding();
    dismissResumeModal();
    showHistoryDetail(sessionId);
  }

  // ---- ルーター購読 ----
  subscribeRoute((route) => {
    if (!route) return;
    // 未登録ユーザーが onboarding 以外に行こうとしたらオンボに戻す
    const uuid = state.getUserUuid();
    if (!uuid && route.name !== "onboarding") {
      navigate(ROUTES.ONBOARDING);
      return;
    }
    switch (route.name) {
      case "onboarding":
        showOnboardingOnly();
        break;
      case "history":
        showHistoryListOnly();
        break;
      case "historyDetail":
        showHistoryDetailOnly(route.params.sessionId);
        break;
      case "root":
      default:
        showChatOnly();
        break;
    }
  });

  // ---- 起動シーケンス（DESIGN §4.5 / §8.2） ----
  async function bootstrap() {
    refreshHeaderUser();

    const uuid = state.getUserUuid();
    if (!uuid) {
      // 初回訪問
      navigate(ROUTES.ONBOARDING);
      startRouter();
      return;
    }

    // R4: 既存 UUID の確認（404 なら localStorage クリア → オンボ）
    try {
      const user = await getUser(uuid);
      if (user && user.userName) {
        state.setUserName(user.userName); // サーバ側の最新 userName で同期
        refreshHeaderUser();
      }
    } catch (err) {
      if (err && err.status === 404) {
        state.clearUser();
        refreshHeaderUser();
        navigate(ROUTES.ONBOARDING);
        startRouter();
        return;
      }
      // その他のエラーはログのみ。オフライン耐性のため継続
      console.warn("getUser failed:", err.message);
    }

    // Feature 21: 再開セッションの判定
    try {
      const payload = await getResumableSession();
      if (payload && payload.session) {
        // まず通常画面に遷移しつつ、ウェルカムは出さずモーダルを出す
        // 履歴画面など別ルートを踏んでいる場合はモーダルのみ出す（フロー維持）
        const currentHash = location.hash || "";
        if (!currentHash.startsWith("#/history") && !currentHash.startsWith("#/onboarding")) {
          navigate(ROUTES.ROOT);
        }
        startRouter();
        // モーダルのみ出す
        showResumeModal(payload);
        return;
      }
    } catch (err) {
      console.warn("getResumableSession failed:", err.message);
    }

    // 通常起動: ウェルカムメッセージを出す
    if (!location.hash || location.hash === "#" || location.hash === "#/") {
      navigate(ROUTES.ROOT);
    }
    startRouter();
    showWelcomeMessage();
  }

  // ---- 新しい相談を始める（Feature 6 + Feature 16） ----
  function performReset() {
    // Sprint 7: 現セッションがあれば DB を close する（await を待たず fire-and-forget でも可だが
    // エラー時トースト対応のためハンドルする）
    const sid = state.getSessionId();
    const uuid = state.getUserUuid();
    if (sid && uuid) {
      import("./api.js").then(({ closeSession }) => {
        closeSession(sid).catch(() => {
          // close 失敗は致命ではない（冪等なので次回 orphan close で埋まる）
        });
      });
    }

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

    // Sprint 7: 初回なら DB にも session を作る（冪等。サーバは INSERT OR IGNORE）
    const uuid = state.getUserUuid();
    const currentSid = state.getSessionId();
    if (uuid && currentSid) {
      // 待たずに発射（失敗してもストリーム側で再度 INSERT OR IGNORE するため致命ではない）
      createSession(currentSid).catch((err) => {
        console.warn("createSession failed:", err.message);
      });
    }

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
      lastEmotion: lastEmotion == null ? null : lastEmotion,
      sessionId: state.getSessionId(),
      userUuid: state.getUserUuid(),
      userMessageId: userId,
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
      onDone(result) {
        const serverReply = result && result.reply;
        const serverAssistantId = result && result.assistantMessageId;
        const serverPersisted = result && result.persisted;

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
          // Sprint 7: サーバ採番 ID への差し替え（絵文字紐付け用）
          if (serverAssistantId && serverAssistantId !== assistantId) {
            state.replaceAssistantMessageId(assistantId, serverAssistantId);
            if (streamingEls && streamingEls.root) {
              streamingEls.root.dataset.messageId = serverAssistantId;
            }
            assistantId = serverAssistantId;
          }
          // done 遷移 → emotion.js の onMessageDone 購読者がセレクタを描画する（R3）
          state.markAssistantDone(assistantId, accumulated);
        }

        // DB 永続化失敗の通知
        if (uuid && serverPersisted === false) {
          showPersistError("相談の記録の保存に失敗しました。");
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

  // ---- 起動 ----
  bootstrap();
});
