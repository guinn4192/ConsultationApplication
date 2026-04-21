// ui/shared.js — テーマ切替 / モード / カテゴリ / 文字数 / setLoading / 新相談ボタン状態
// Sprint 5 の app.js に存在したロジックを ESM に移植（DESIGN §8.1 R2: ロジック改変禁止）。

import { state } from "../state.js";

export const MAX_CHARS = 1000;
export const WARN_THRESHOLD = 900;

export const MODE_DESCRIPTIONS = {
  default: "共感とアドバイスをバランスよく提供します",
  empathy: "解決策は提示せず、ひたすら親身に寄り添い傾聴します",
  solution: "具体的な解決策を一緒に考え、行動の筋道を提案します",
};

let refs = null;

export function initShared({
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
}) {
  refs = {
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
  };

  // ---- Theme ----
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
    themeButtons.forEach((b) => {
      b.classList.toggle("active", b.dataset.theme === savedTheme);
    });
  }

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      themeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const theme = btn.dataset.theme;
      if (theme === "default") {
        document.documentElement.removeAttribute("data-theme");
        localStorage.removeItem("theme");
      } else {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
      }
    });
  });

  // ---- Mode ----
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const m = btn.dataset.mode;
      state.setSelectedMode(m);
      modeDescription.textContent = MODE_DESCRIPTIONS[m] || MODE_DESCRIPTIONS.default;
    });
  });

  // ---- Category ----
  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.category;
      if (state.getSelectedCategory() === cat) {
        btn.classList.remove("active");
        state.setSelectedCategory(null);
      } else {
        categoryButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.setSelectedCategory(cat);
      }
    });
  });

  // ---- Char count ----
  input.addEventListener("input", () => {
    updateCharCount();
  });

  // Enter key sends (Shift+Enter for newline)
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = document.getElementById("consult-form");
      if (form) form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  updateCharCount();
  updateNewConsultationButton();
}

export function updateCharCount() {
  if (!refs) return;
  const { input, charCount, sendButton, chatMessages } = refs;
  const len = input.value.length;
  charCount.textContent = `${len} / ${MAX_CHARS}`;

  charCount.classList.remove("warning", "over");
  const isStreaming = state.isStreaming();
  const loading = chatMessages.querySelector("#loading-indicator") != null;

  if (len > MAX_CHARS) {
    charCount.classList.add("over");
    sendButton.disabled = true;
  } else if (len >= WARN_THRESHOLD) {
    charCount.classList.add("warning");
    if (!loading && !isStreaming) sendButton.disabled = false;
  } else {
    if (!loading && !isStreaming) sendButton.disabled = false;
  }
}

export function updateNewConsultationButton() {
  if (!refs) return;
  const { newConsultationButton } = refs;
  if (state.isStreaming()) {
    newConsultationButton.disabled = true;
    return;
  }
  newConsultationButton.disabled = state.getMessages().length === 0;
}

export function setLoading(on) {
  if (!refs) return;
  const { input, sendButton, newConsultationButton, chatMessages } = refs;

  if (on) {
    sendButton.disabled = true;
    input.disabled = true;
    newConsultationButton.disabled = true;
  } else {
    if (!state.isStreaming()) {
      input.disabled = false;
      updateCharCount();
      updateNewConsultationButton();
    }
  }

  const existing = chatMessages.querySelector("#loading-indicator");
  if (on) {
    if (!existing) {
      const loader = document.createElement("div");
      loader.id = "loading-indicator";
      loader.classList.add("loading-indicator");
      const dots = document.createElement("div");
      dots.classList.add("loading-dots");
      for (let i = 0; i < 3; i++) dots.appendChild(document.createElement("span"));
      loader.appendChild(dots);
      const label = document.createElement("span");
      label.textContent = "回答を考えています...";
      loader.appendChild(label);
      chatMessages.appendChild(loader);
      // scroll
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } else if (existing) {
    existing.remove();
  }
}

export function showError(msg) {
  if (!refs) return;
  refs.errorMessage.textContent = msg;
  refs.errorMessage.hidden = false;
}

export function clearError() {
  if (!refs) return;
  refs.errorMessage.textContent = "";
  refs.errorMessage.hidden = true;
}

export function resetModeAndCategoryUi() {
  if (!refs) return;
  const { modeButtons, categoryButtons, modeDescription, input } = refs;
  state.setSelectedCategory(null);
  state.setSelectedMode("default");
  categoryButtons.forEach((b) => b.classList.remove("active"));
  modeButtons.forEach((b) => b.classList.remove("active"));
  const defaultBtn = document.querySelector('.mode-button[data-mode="default"]');
  if (defaultBtn) defaultBtn.classList.add("active");
  if (modeDescription) modeDescription.textContent = MODE_DESCRIPTIONS.default;
  input.value = "";
}

export function getRefs() {
  return refs;
}
