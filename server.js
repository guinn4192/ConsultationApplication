require("dotenv").config({ quiet: true });
const express = require("express");
const path = require("path");
const { randomUUID } = require("crypto");
const Anthropic = require("@anthropic-ai/sdk");

// Sprint 7: DB 初期化 + ルート切り出し
const { openDb } = require("./src/db/driver");
const { initSchema } = require("./src/db/schema");
const { createRepo } = require("./src/db/repo");
const { createUserRouter } = require("./src/routes/user");
const { createSessionsRouter } = require("./src/routes/sessions");
const { createEmotionsRouter } = require("./src/routes/emotions");
const { createHistoryRouter } = require("./src/routes/history");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ============================================================================
// Sprint 7: DB 初期化
// ============================================================================
const DB_PATH = path.join(__dirname, "data", "app.db");
let db = null;
let repo = null;

try {
  db = openDb(DB_PATH);
  const { orphanClosed } = initSchema(db);
  console.log(`DB initialized: data/app.db (driver: ${db.impl}, WAL)`);
  if (orphanClosed > 0) {
    console.log(`Closed ${orphanClosed} orphan sessions`);
  }
  repo = createRepo(db);
} catch (err) {
  console.error("DB initialization failed:", err.message);
  process.exit(1);
}

// ルート登録
app.use("/api/user", createUserRouter(repo));
app.use("/api/sessions", createSessionsRouter(repo));
app.use("/api/emotions", createEmotionsRouter(repo));
app.use("/api/history", createHistoryRouter(repo));

// ============================================================================
// Consult endpoints (Sprint 5/6 踏襲 + Sprint 7 DB 書き込み)
// ============================================================================

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

/**
 * x-user-uuid ヘッダまたは body.userUuid から userUuid を解決（§6.1 注記）。
 */
function resolveUserUuidForConsult(req) {
  const fromHeader = req.get("x-user-uuid");
  if (fromHeader && typeof fromHeader === "string") return fromHeader.trim();
  if (req.body && typeof req.body.userUuid === "string") return req.body.userUuid.trim();
  return null;
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

  // Sprint 7: userUuid / sessionId / userMessageId 受領（ヘッダ優先 / body フォールバック）
  const userUuid = resolveUserUuidForConsult(req);
  const body = req.body || {};
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : null;
  const userMessageId =
    typeof body.userMessageId === "string" ? body.userMessageId.trim() : null;
  const mode = typeof body.mode === "string" ? body.mode : null;
  const category = typeof body.category === "string" ? body.category : null;

  // DB 書き込み用の判定: userUuid + sessionId + 最終 user メッセージがあれば ON
  const canPersist = !!(userUuid && sessionId && repo);
  let persistedUser = false;
  // 既存ユーザーの確認（§7.6 / §7.4 ユーザー分離）。見つからない場合は永続化スキップ
  if (canPersist) {
    try {
      const user = repo.getUser(userUuid);
      if (!user) {
        // 認可されないユーザーからのストリーム要求は SSE は走らせつつ DB 書き込みのみスキップ
      } else {
        // セッションの存在保証（冪等）
        repo.createSession(sessionId, userUuid);
        const session = repo.getSession(sessionId);
        if (session && session.userUuid === userUuid) {
          // 最後の user メッセージを 1 件だけ INSERT（再送時は id 重複になるので try/catch）
          const lastUserMsg =
            conversationMessages.length > 0 &&
            conversationMessages[conversationMessages.length - 1].role === "user"
              ? conversationMessages[conversationMessages.length - 1]
              : null;
          if (lastUserMsg) {
            const id = userMessageId || randomUUID();
            try {
              repo.insertMessage({
                id,
                sessionId,
                role: "user",
                content: lastUserMsg.content,
                mode,
                category,
              });
              persistedUser = true;
            } catch (e) {
              // PRIMARY KEY 競合等は無視（クライアント再送時）
              persistedUser = false;
            }
          }
        }
      }
    } catch (e) {
      console.error("DB pre-write failed in /api/consult/stream:", e.message);
    }
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

      // Sprint 7: done イベント送出前に assistant メッセージを INSERT
      let assistantMessageId = randomUUID();
      let persisted = false;
      if (canPersist) {
        try {
          const user = repo.getUser(userUuid);
          if (user) {
            const session = repo.getSession(sessionId);
            if (session && session.userUuid === userUuid) {
              repo.insertMessage({
                id: assistantMessageId,
                sessionId,
                role: "assistant",
                content: reply,
                mode: null,
                category: null,
              });
              persisted = true;
            }
          }
        } catch (e) {
          console.error("DB insertMessage(assistant) failed:", e.message);
          persisted = false;
        }
      }

      sendEvent("done", {
        reply,
        assistantMessageId,
        persisted: persisted && persistedUser,
      });
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
