// src/routes/emotions.js
// POST /api/emotions

"use strict";

const express = require("express");

function resolveUserUuid(req) {
  const fromHeader = req.get("x-user-uuid");
  if (fromHeader && typeof fromHeader === "string") return fromHeader.trim();
  if (req.body && typeof req.body.userUuid === "string") return req.body.userUuid.trim();
  return null;
}

function createEmotionsRouter(repo) {
  const router = express.Router();

  // POST /api/emotions
  // Header: x-user-uuid
  // body: { sessionId, messageId|null, emojiValue }
  router.post("/", (req, res) => {
    try {
      const userUuid = resolveUserUuid(req);
      if (!userUuid) {
        return res.status(401).json({ error: "ユーザー識別情報がありません。" });
      }
      const { sessionId, messageId, emojiValue } = req.body || {};

      if (typeof sessionId !== "string" || !sessionId) {
        return res.status(400).json({ error: "sessionId が必要です。" });
      }
      if (
        !(
          typeof emojiValue === "number" &&
          Number.isInteger(emojiValue) &&
          emojiValue >= 1 &&
          emojiValue <= 5
        )
      ) {
        return res.status(400).json({ error: "emojiValue は 1〜5 の整数です。" });
      }
      // セッションの所有者を確認
      const session = repo.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "セッションが見つかりません。" });
      }
      if (session.userUuid !== userUuid) {
        return res.status(403).json({ error: "ユーザー不一致。" });
      }
      const result = repo.insertEmotion({
        sessionId,
        messageId: typeof messageId === "string" ? messageId : null,
        emojiValue,
      });
      return res.status(201).json(result);
    } catch (err) {
      console.error("POST /api/emotions error:", err.message);
      return res.status(500).json({ error: "感情記録の保存に失敗しました。" });
    }
  });

  return router;
}

module.exports = { createEmotionsRouter };
