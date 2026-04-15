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

app.post("/api/consult", async (req, res) => {
  const { message, messages, category, mode } = req.body;

  // Support both single message (backward compat) and conversation history
  const conversationMessages = messages && Array.isArray(messages) && messages.length > 0
    ? messages
    : message && message.trim() !== ""
      ? [{ role: "user", content: message }]
      : null;

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

    // Build system prompt based on mode
    let systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.default;
    if (category && typeof category === "string" && category.trim() !== "") {
      systemPrompt += `\n\n現在のユーザーの相談カテゴリは「${category}」です。このカテゴリに特に関連したアドバイスや視点を意識して回答してください。`;
    }

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
