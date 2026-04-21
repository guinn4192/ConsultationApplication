// src/routes/sessions.js
// POST /api/sessions             … 新規セッション作成
// POST /api/sessions/:id/close   … 冪等クローズ
// GET  /api/sessions/resumable   … 当日未 close の最新 1 件（Feature 21）

"use strict";

const express = require("express");
const { randomUUID } = require("crypto");

/**
 * x-user-uuid ヘッダを取得 + バリデーション。
 */
function resolveUserUuid(req) {
  const fromHeader = req.get("x-user-uuid");
  if (fromHeader && typeof fromHeader === "string") return fromHeader.trim();
  // body fallback（SSE 以外では基本使わない）
  if (req.body && typeof req.body.userUuid === "string") return req.body.userUuid.trim();
  return null;
}

function createSessionsRouter(repo) {
  const router = express.Router();

  // POST /api/sessions
  // Header: x-user-uuid
  // body: { clientSessionId? }
  router.post("/", (req, res) => {
    try {
      const userUuid = resolveUserUuid(req);
      if (!userUuid) {
        return res.status(401).json({ error: "ユーザー識別情報がありません。" });
      }
      const user = repo.getUser(userUuid);
      if (!user) {
        return res.status(404).json({ error: "ユーザーが見つかりません。" });
      }
      const sessionId =
        (req.body && typeof req.body.clientSessionId === "string"
          ? req.body.clientSessionId.trim()
          : "") || randomUUID();
      const { sessionId: sid, startedAt } = repo.createSession(sessionId, userUuid);
      return res.status(201).json({ sessionId: sid, startedAt });
    } catch (err) {
      console.error("POST /api/sessions error:", err.message);
      return res.status(500).json({ error: "セッション作成に失敗しました。" });
    }
  });

  // GET /api/sessions/resumable?uuid=<userUuid>
  // Header: x-user-uuid
  router.get("/resumable", (req, res) => {
    try {
      const userUuid = resolveUserUuid(req) || (req.query && req.query.uuid);
      if (!userUuid) {
        return res.status(401).json({ error: "ユーザー識別情報がありません。" });
      }
      // ヘッダとクエリ両方ある場合は一致を要求（ユーザー分離、§7.4）
      if (
        req.get("x-user-uuid") &&
        req.query &&
        req.query.uuid &&
        req.get("x-user-uuid") !== req.query.uuid
      ) {
        return res.status(403).json({ error: "ユーザー不一致。" });
      }
      const user = repo.getUser(userUuid);
      if (!user) {
        return res.status(404).json({ error: "ユーザーが見つかりません。" });
      }
      const result = repo.getResumableSession(userUuid);
      if (!result) {
        // 該当なし → 204
        return res.status(204).end();
      }
      return res.json(result);
    } catch (err) {
      console.error("GET /api/sessions/resumable error:", err.message);
      return res.status(500).json({ error: "再開セッション取得に失敗しました。" });
    }
  });

  // POST /api/sessions/:id/close  — 冪等
  router.post("/:id/close", (req, res) => {
    try {
      const userUuid = resolveUserUuid(req);
      if (!userUuid) {
        return res.status(401).json({ error: "ユーザー識別情報がありません。" });
      }
      const sessionId = req.params.id;
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId が不正です。" });
      }
      const result = repo.closeSession(sessionId, userUuid);
      if (!result) {
        return res.status(404).json({ error: "セッションが見つかりません。" });
      }
      return res.json({
        sessionId: result.sessionId,
        closedAt: result.closedAt,
        alreadyClosed: result.alreadyClosed,
      });
    } catch (err) {
      console.error("POST /api/sessions/:id/close error:", err.message);
      return res.status(500).json({ error: "セッションクローズに失敗しました。" });
    }
  });

  return router;
}

module.exports = { createSessionsRouter };
