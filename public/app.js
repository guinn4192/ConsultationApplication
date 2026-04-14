document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("consult-form");
  const input = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const errorMessage = document.getElementById("error-message");
  const chatMessages = document.getElementById("chat-messages");
  const newConsultationButton = document.getElementById("new-consultation-button");
  const categoryButtons = document.querySelectorAll(".category-button");
  const charCount = document.getElementById("char-count");

  const MAX_CHARS = 1000;
  const WARN_THRESHOLD = 900;

  // Conversation history for Claude API
  let conversationHistory = [];
  let selectedCategory = null;

  // Show welcome message on page load
  showWelcomeMessage();

  // Category button selection
  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const category = btn.dataset.category;
      if (selectedCategory === category) {
        // Deselect
        btn.classList.remove("active");
        selectedCategory = null;
      } else {
        // Deselect previous
        categoryButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedCategory = category;
      }
    });
  });

  // Character count feedback
  input.addEventListener("input", () => {
    updateCharCount();
  });

  function updateCharCount() {
    const len = input.value.length;
    charCount.textContent = `${len} / ${MAX_CHARS}`;

    charCount.classList.remove("warning", "over");
    if (len > MAX_CHARS) {
      charCount.classList.add("over");
      sendButton.disabled = true;
    } else if (len >= WARN_THRESHOLD) {
      charCount.classList.add("warning");
      // Only re-enable if not loading
      if (!document.getElementById("loading-indicator")) {
        sendButton.disabled = false;
      }
    } else {
      if (!document.getElementById("loading-indicator")) {
        sendButton.disabled = false;
      }
    }
  }

  // Enter key sends (Shift+Enter for newline)
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  // New consultation button
  newConsultationButton.addEventListener("click", () => {
    conversationHistory = [];
    selectedCategory = null;
    categoryButtons.forEach((b) => b.classList.remove("active"));
    chatMessages.innerHTML = "";
    showWelcomeMessage();
    updateNewConsultationButton();
    input.value = "";
    updateCharCount();
    input.focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = input.value.trim();

    // Validation: empty check
    if (!message) {
      showError("相談内容を入力してください。");
      return;
    }

    // Validation: over limit
    if (input.value.length > MAX_CHARS) {
      showError(`文字数が上限（${MAX_CHARS}文字）を超えています。`);
      return;
    }

    clearError();

    // Remove welcome message if present
    const welcome = document.getElementById("welcome-message");
    if (welcome) {
      welcome.remove();
    }

    addMessage(message, "user");

    // Add user message to conversation history
    conversationHistory.push({ role: "user", content: message });

    input.value = "";
    updateCharCount();
    setLoading(true);
    updateNewConsultationButton();

    try {
      const res = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory,
          category: selectedCategory,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "エラーが発生しました。");
      }

      addMessage(data.reply, "ai");

      // Add AI response to conversation history
      conversationHistory.push({ role: "assistant", content: data.reply });
    } catch (err) {
      addMessage(
        err.message || "通信エラーが発生しました。もう一度お試しください。",
        "error"
      );
    } finally {
      setLoading(false);
      updateNewConsultationButton();
    }
  });

  function showWelcomeMessage() {
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
      "・新しい話題で相談したいときは「新しい相談を始める」を押してください";
    div.appendChild(content);

    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function addMessage(text, type) {
    const div = document.createElement("div");
    div.classList.add("message");

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

    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function setLoading(on) {
    sendButton.disabled = on;
    input.disabled = on;

    // If loading ends, re-check char count to restore correct button state
    if (!on) {
      updateCharCount();
    }

    const existing = document.getElementById("loading-indicator");
    if (on) {
      const loader = document.createElement("div");
      loader.id = "loading-indicator";
      loader.classList.add("loading-indicator");
      loader.innerHTML = `
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
        <span>回答を考えています...</span>
      `;
      chatMessages.appendChild(loader);
      scrollToBottom();
    } else if (existing) {
      existing.remove();
    }
  }

  function updateNewConsultationButton() {
    newConsultationButton.disabled = conversationHistory.length === 0;
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.hidden = false;
  }

  function clearError() {
    errorMessage.textContent = "";
    errorMessage.hidden = true;
  }

  // Initialize button state
  updateNewConsultationButton();
  updateCharCount();
});
