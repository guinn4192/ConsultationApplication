// src/routes/history.js
// GET /api/history?uuid=...             … 日付別セッション一覧
// GET /api/history/:sessionId           … セッション詳細（messages + emotions）

"use strict";

const express = require("express");

function resolveUserUuid(req) {
  const fromHeader = req.get("x-user-uuid");
  if (fromHeader && typeof fromHeader === "string") return fromHeader.trim();
  if (req.query && typeof req.query.uuid === "string") return req.query.uuid.trim();
  return null;
}

function createHistoryRouter(repo) {
  const router = express.Router();

  // GET /api/history?uuid=...
  router.get("/", (req, res) => {
    try {
      const userUuid = resolveUserUuid(req);
      if (!userUuid) {
        return res.status(401).json({ error: "ユーザー識別情報がありません。" });
      }
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
      const rows = repo.listSessionsByUser(userUuid);
      const sessions = rows.map((r) => ({
        sessionId: r.sessionId,
        startedAt: r.startedAt,
        closedAt: r.closedAt,
        preview:
          r.preview == null
            ? ""
            : r.preview.length > 50
              ? r.preview.slice(0, 50) + "…"
              : r.preview,
      }));
      return res.json({ sessions });
    } catch (err) {
      console.error("GET /api/history error:", err.message);
      return res.status(500).json({ error: "履歴の取得に失敗しました。" });
    }
  });

  // GET /api/history/:sessionId
  router.get("/:sessionId", (req, res) => {
    try {
      const userUuid = resolveUserUuid(req);
      if (!userUuid) {
        return res.status(401).json({ error: "ユーザー識別情報がありません。" });
      }
      const sessionId = req.params.sessionId;
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId が不正です。" });
      }
      const detail = repo.getSessionDetail(sessionId, userUuid);
      if (!detail) {
        return res.status(404).json({ error: "セッションが見つかりません。" });
      }
      if (detail.forbidden) {
        return res.status(403).json({ error: "ユーザー不一致。" });
      }
      return res.json(detail);
    } catch (err) {
      console.error("GET /api/history/:sessionId error:", err.message);
      return res.status(500).json({ error: "履歴詳細の取得に失敗しました。" });
    }
  });

  return router;
}

module.exports = { createHistoryRouter };
