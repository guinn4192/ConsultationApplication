const express = require("express");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPT = `あなたは「こころの相談室」という相談アプリのAIカウンセラーです。
以下のルールに従って回答してください：

1. まずユーザーの悩みに共感し、気持ちを受け止めてください。
2. 批判的・冷淡な表現は絶対に使わないでください。
3. 温かく親身なトーンで回答してください。
4. 具体的で実践的なアドバイスがあれば、優しく提案してください。
5. 回答は簡潔にまとめつつ、相手が安心できる言葉を選んでください。
6. 日本語で回答してください。`;

app.post("/api/consult", async (req, res) => {
  const { message, messages, category } = req.body;

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

    // Build system prompt with optional category context
    let systemPrompt = SYSTEM_PROMPT;
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
    console.error("Claude API error:", err);
    const statusCode = err.status || 500;
    const errorMessage =
      statusCode === 401
        ? "APIキーが無効です。正しいキーを設定してください。"
        : "AIからの回答を取得できませんでした。しばらくしてからもう一度お試しください。";
    res.status(statusCode).json({ error: errorMessage });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
