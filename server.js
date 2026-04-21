require("dotenv").config({ quiet: true });
const express = require("express");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPTS = {
  empathy: `あなたは「こころの相談室」という相談アプリのAIカウンセラーです。
【共感モード】で動作しています。以下のルールに従って回答してください：

1. ユーザーの悩みにひたすら寄り添い、気持ちを受け止めてください。
2. 解決策やアドバイスは提示しないでください。求められても「一緒に気持ちを整理しましょう」と傾聴を続けてください。
3. 「つらかったですね」「それは大変でしたね」「そう感じるのは自然なことです」のように共感の言葉を使ってください。
4. ユーザーの感情に名前をつけて返してください（例：「悲しさ」「もどかしさ」「不安」）。
5. 批判的・冷淡な表現は絶対に使わないでください。
6. 日本語で回答してください。`,

  solution: `あなたは「こころの相談室」という相談アプリのAIカウンセラーです。
【解決モード】で動作しています。以下のルールに従って回答してください：

1. まずユーザーの悩みに軽く共感した上で、具体的な解決策を一緒に考えてください。
2. 問題を整理し、ステップバイステップで解決の筋道を提案してください。
3. 複数の選択肢がある場合はそれぞれのメリット・デメリットを示してください。
4. 「こういう方法はいかがでしょうか」「まず最初に〜してみましょう」のように具体的に提案してください。
5. 批判的・冷淡な表現は絶対に使わないでください。温かいトーンを保ちつつ建設的に。
6. 日本語で回答してください。`,

  default: `あなたは「こころの相談室」という相談アプリのAIカウンセラーです。
以下のルールに従って回答してください：

1. まずユーザーの悩みに共感し、気持ちを受け止めてください。
2. 批判的・冷淡な表現は絶対に使わないでください。
3. 温かく親身なトーンで回答してください。
4. 具体的で実践的なアドバイスがあれば、優しく提案してください。
5. 回答は簡潔にまとめつつ、相手が安心できる言葉を選んでください。
6. 日本語で回答してください。`,
};

// Sprint 6: Emotion → tone addendum.
// 「モードの指示を踏まえた上で、補足:」で始めることで、
// 既存モード（バランス/共感/解決）を上書きせず補足する形でトーンを微調整する（DESIGN.md §8.1 / R7）。
const TONE_ADDENDUM = {
  1: "\n\n補足: ユーザーが直近に記録した気分は「とてもつらい😢」です。モードの指示を踏まえた上で、特に強い共感と傾聴を重視し、「つらかったですね」「その気持ちを受け止めます」等の受容表現を中心に据えてください。解決策の提示は控えめにしてください。",
  2: "\n\n補足: ユーザーが直近に記録した気分は「不安😟」です。モードの指示を踏まえた上で、断定や強い助言を避け、選択肢を並べて一緒に考える姿勢で寄り添ってください。",
  3: null, // 中立は addendum なし
  4: "\n\n補足: ユーザーが直近に記録した気分は「前向き🙂」です。モードの指示を踏まえた上で、「その調子です」「一緒に次の一歩を考えましょう」等の後押し表現を織り込んでください。",
  5: "\n\n補足: ユーザーが直近に記録した気分は「とても前向き😊」です。モードの指示を踏まえた上で、建設的で行動指向の提案を前面に出し、次の具体的な一歩に繋がる言葉を選んでください。",
};

function buildConversationContext(req) {
  const { message, messages, category, mode, lastEmotion } = req.body;

  const conversationMessages = messages && Array.isArray(messages) && messages.length > 0
    ? messages
    : message && message.trim() !== ""
      ? [{ role: "user", content: message }]
      : null;

  let systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.default;
  if (category && typeof category === "string" && category.trim() !== "") {
    systemPrompt += `\n\n現在のユーザーの相談カテゴリは「${category}」です。このカテゴリに特に関連したアドバイスや視点を意識して回答してください。`;
  }

  // Sprint 6: lastEmotion (1-5) があれば末尾にトーン補足を append。
  // 1-5 以外 / null / undefined の場合は何もしない（中立 3 も addendum なし）。
  if (
    typeof lastEmotion === "number" &&
    Number.isInteger(lastEmotion) &&
    lastEmotion >= 1 &&
    lastEmotion <= 5
  ) {
    const addendum = TONE_ADDENDUM[lastEmotion];
    if (addendum) {
      systemPrompt += addendum;
    }
  }

  return { conversationMessages, systemPrompt };
}

app.post("/api/consult", async (req, res) => {
  const { conversationMessages, systemPrompt } = buildConversationContext(req);

  if (!conversationMessages) {
    return res.status(400).json({ error: "相談内容を入力してください。" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "APIキーが設定されていません。環境変数 ANTHROPIC_API_KEY を設定してください。",
    });
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationMessages,
    });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    res.json({ reply });
  } catch (err) {
    console.error("Claude API error:", err.message);
    const statusCode = err.status || 500;
    const errorMessage =
      statusCode === 401
        ? "APIキーが無効です。正しいキーを設定してください。"
        : "AIからの回答を取得できませんでした。しばらくしてからもう一度お試しください。";
    res.status(statusCode).json({ error: errorMessage });
  }
});

app.post("/api/consult/stream", async (req, res) => {
  const { conversationMessages, systemPrompt } = buildConversationContext(req);

  if (!conversationMessages) {
    res.status(400).json({ error: "相談内容を入力してください。" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "APIキーが設定されていません。環境変数 ANTHROPIC_API_KEY を設定してください。",
    });
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const safeWrite = (chunk) => {
    if (!res.writableEnded && !res.destroyed) {
      try {
        res.write(chunk);
      } catch (_) {
        // socket may already be torn down
      }
    }
  };

  const sendEvent = (event, data) => {
    safeWrite(`event: ${event}\n`);
    safeWrite(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Detect true client disconnect via the *response* socket close event.
  // NOTE: req.on("close") is NOT reliable here — on Express 4 it can fire
  // immediately once the request body has been fully received, even while
  // the connection is still open. We use res.on("close") + an AbortController
  // that we pass to the Anthropic SDK so that the upstream request is
  // cancelled when the real client goes away.
  const abortController = new AbortController();
  let clientAborted = false;
  const onResClose = () => {
    if (!res.writableEnded) {
      clientAborted = true;
      abortController.abort();
    }
  };
  res.on("close", onResClose);

  // Keep-alive comment helps some proxies flush headers / detect liveness.
  safeWrite(": ping\n\n");

  let finished = false;
  try {
    const client = new Anthropic({ apiKey });

    const stream = client.messages.stream(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: conversationMessages,
      },
      { signal: abortController.signal }
    );

    for await (const event of stream) {
      if (clientAborted) break;
      if (
        event.type === "content_block_delta" &&
        event.delta &&
        event.delta.type === "text_delta" &&
        typeof event.delta.text === "string" &&
        event.delta.text.length > 0
      ) {
        sendEvent("delta", { text: event.delta.text });
      }
    }

    if (!clientAborted) {
      const finalMessage = await stream.finalMessage();
      const reply = finalMessage.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      sendEvent("done", { reply });
      finished = true;
    }
  } catch (err) {
    // If the client went away, swallow abort errors quietly.
    const isAbort =
      clientAborted ||
      err?.name === "AbortError" ||
      err?.code === "ABORT_ERR" ||
      /aborted/i.test(err?.message || "");

    if (!isAbort) {
      console.error("Claude API stream error:", err.message);
      const statusCode = err.status || 500;
      const errorMessage =
        statusCode === 401
          ? "APIキーが無効です。正しいキーを設定してください。"
          : "AIからの回答を取得できませんでした。しばらくしてからもう一度お試しください。";
      if (!res.headersSent) {
        // Headers should already be flushed above, but keep as safety net.
        res.status(statusCode).json({ error: errorMessage });
        return;
      }
      sendEvent("error", { error: errorMessage });
    }
  } finally {
    res.off("close", onResClose);
    if (!res.writableEnded) {
      try {
        res.end();
      } catch (_) {
        // already closed by the transport
      }
    }
    // Suppress unused-var lint if any
    void finished;
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${PORT} is in use. Killing existing process...`);
    const { execSync } = require("child_process");
    try {
      const output = execSync(`netstat -ano | findstr :${PORT}`, { encoding: "utf-8" });
      const lines = output.trim().split("\n");
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { encoding: "utf-8" });
          console.log(`Killed PID ${pid}`);
        } catch (_) {}
      }
      setTimeout(() => {
        app.listen(PORT, () => {
          console.log(`Server running at http://localhost:${PORT}`);
        });
      }, 500);
    } catch (_) {
      console.error(`Failed to free port ${PORT}. Please manually kill the process.`);
      process.exit(1);
    }
  } else {
    console.error("Server error:", err.message);
    process.exit(1);
  }
});
