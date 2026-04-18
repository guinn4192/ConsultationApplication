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

  const MAX_CHARS = 1000;
  const WARN_THRESHOLD = 900;

  const MODE_DESCRIPTIONS = {
    default: "共感とアドバイスをバランスよく提供します",
    empathy: "解決策は提示せず、ひたすら親身に寄り添い傾聴します",
    solution: "具体的な解決策を一緒に考え、行動の筋道を提案します",
  };

  // Conversation history for Claude API
  let conversationHistory = [];
  let selectedCategory = null;
  let selectedMode = "default";

  // Theme selection
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

  // Show welcome message on page load
  showWelcomeMessage();

  // Mode button selection
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedMode = btn.dataset.mode;
      modeDescription.textContent = MODE_DESCRIPTIONS[selectedMode];
    });
  });

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

  // Streaming state flag
  let isStreaming = false;

  function updateCharCount() {
    const len = input.value.length;
    charCount.textContent = `${len} / ${MAX_CHARS}`;

    charCount.classList.remove("warning", "over");
    if (len > MAX_CHARS) {
      charCount.classList.add("over");
      sendButton.disabled = true;
    } else if (len >= WARN_THRESHOLD) {
      charCount.classList.add("warning");
      // Only re-enable if not loading / streaming
      if (!document.getElementById("loading-indicator") && !isStreaming) {
        sendButton.disabled = false;
      }
    } else {
      if (!document.getElementById("loading-indicator") && !isStreaming) {
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
    selectedMode = "default";
    categoryButtons.forEach((b) => b.classList.remove("active"));
    modeButtons.forEach((b) => b.classList.remove("active"));
    document.querySelector('.mode-button[data-mode="default"]').classList.add("active");
    modeDescription.textContent = MODE_DESCRIPTIONS.default;
    chatMessages.innerHTML = "";
    showWelcomeMessage();
    updateNewConsultationButton();
    input.value = "";
    updateCharCount();
    input.focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isStreaming) return;
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

    let aiMessageContent = null;
    let accumulatedText = "";
    let streamStarted = false;

    // Client-side safety timeouts so the UI can always recover even if
    // the server hangs or never closes the response.
    const OVERALL_TIMEOUT_MS = 60000; // whole request budget
    const IDLE_TIMEOUT_MS = 20000; // no bytes from server for this long

    const abortController = new AbortController();
    let timedOutReason = null;

    const overallTimer = setTimeout(() => {
      timedOutReason =
        "AIからの回答を取得できませんでした。しばらくしてからもう一度お試しください。";
      try {
        abortController.abort();
      } catch (_) {}
    }, OVERALL_TIMEOUT_MS);

    let idleTimer = null;
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        timedOutReason =
          "AIからの応答がありません。ネットワーク状況を確認の上、もう一度お試しください。";
        try {
          abortController.abort();
        } catch (_) {}
      }, IDLE_TIMEOUT_MS);
    };

    try {
      const res = await fetch("/api/consult/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory,
          category: selectedCategory,
          mode: selectedMode,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        // Non-streaming error (JSON)
        let errMsg = "エラーが発生しました。";
        try {
          const data = await res.json();
          if (data && data.error) errMsg = data.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream") || !res.body) {
        throw new Error("ストリーミングレスポンスを受信できませんでした。");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      resetIdleTimer();

      const handleEvent = (eventName, dataStr) => {
        let payload;
        try {
          payload = JSON.parse(dataStr);
        } catch (_) {
          return;
        }
        if (eventName === "delta" && payload && typeof payload.text === "string") {
          if (!streamStarted) {
            streamStarted = true;
            // Mark streaming first so setLoading(false) keeps input disabled
            isStreaming = true;
            // Switch from loading indicator to AI message bubble
            setLoading(false);
            sendButton.disabled = true;
            input.disabled = true;
            newConsultationButton.disabled = true;
            aiMessageContent = addStreamingMessage();
          }
          accumulatedText += payload.text;
          if (aiMessageContent) {
            aiMessageContent.textContent = accumulatedText;
            scrollToBottom();
          }
        } else if (eventName === "error" && payload && payload.error) {
          throw new Error(payload.error);
        } else if (eventName === "done") {
          // Prefer server's final reply if available
          if (payload && typeof payload.reply === "string" && payload.reply.length > 0) {
            accumulatedText = payload.reply;
            if (aiMessageContent) {
              aiMessageContent.textContent = accumulatedText;
            }
          }
        }
      };

      // Parse SSE stream
      // Each event is separated by a blank line (\n\n). Each line starts with either "event:" or "data:".
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        resetIdleTimer();
        buffer += decoder.decode(value, { stream: true });

        let sepIndex;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);

          let eventName = "message";
          const dataLines = [];
          const lines = rawEvent.split("\n");
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }
          if (dataLines.length === 0) continue;
          const dataStr = dataLines.join("\n");
          try {
            handleEvent(eventName, dataStr);
          } catch (inner) {
            throw inner;
          }
        }
      }

      if (!streamStarted) {
        // No delta arrived but connection closed - treat as error
        throw new Error("AIからの回答を取得できませんでした。しばらくしてからもう一度お試しください。");
      }

      // Mark streaming bubble as done (hides blinking cursor)
      if (aiMessageContent && aiMessageContent.parentElement) {
        aiMessageContent.parentElement.classList.add("streaming-done");
      }

      // Add final AI response to conversation history
      if (accumulatedText.length > 0) {
        conversationHistory.push({ role: "assistant", content: accumulatedText });
      }
    } catch (err) {
      // Error handling: if we had already begun streaming, remove the partial bubble and show error
      if (aiMessageContent && aiMessageContent.parentElement) {
        aiMessageContent.parentElement.remove();
      }
      let msg;
      if (timedOutReason) {
        msg = timedOutReason;
      } else if (err && err.name === "AbortError") {
        msg =
          "AIからの回答を取得できませんでした。しばらくしてからもう一度お試しください。";
      } else {
        msg = err.message || "通信エラーが発生しました。もう一度お試しください。";
      }
      addMessage(msg, "error");
    } finally {
      clearTimeout(overallTimer);
      if (idleTimer) clearTimeout(idleTimer);
      isStreaming = false;
      setLoading(false);
      input.disabled = false;
      updateNewConsultationButton();
      updateCharCount();
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

  // Create an empty AI message bubble for streaming; returns the content span
  function addStreamingMessage() {
    const div = document.createElement("div");
    div.classList.add("message", "message-ai", "message-streaming");

    const label = document.createElement("span");
    label.classList.add("message-label");
    label.textContent = "AIカウンセラー";
    div.appendChild(label);

    const content = document.createElement("span");
    content.classList.add("message-streaming-content");
    content.textContent = "";
    div.appendChild(content);

    chatMessages.appendChild(div);
    scrollToBottom();
    return content;
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function setLoading(on) {
    if (on) {
      sendButton.disabled = true;
      input.disabled = true;
      newConsultationButton.disabled = true;
    } else {
      // If not streaming, re-enable; otherwise, streaming logic controls state
      if (!isStreaming) {
        input.disabled = false;
        // send button / new-consultation button re-enabled via updateCharCount / updateNewConsultationButton
        updateCharCount();
      }
    }

    const existing = document.getElementById("loading-indicator");
    if (on) {
      if (!existing) {
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
      }
    } else if (existing) {
      existing.remove();
    }
  }

  function updateNewConsultationButton() {
    if (isStreaming) {
      newConsultationButton.disabled = true;
      return;
    }
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
