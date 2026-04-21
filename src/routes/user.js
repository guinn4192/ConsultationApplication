// src/routes/user.js
// POST /api/user/register, GET /api/user/:uuid
// DESIGN.md §4.1 / §6 / §7.2

"use strict";

const express = require("express");

/**
 * @param {object} repo - src/db/repo.js createRepo の戻り
 */
function createUserRouter(repo) {
  const router = express.Router();

  // POST /api/user/register
  // body: { userName }
  router.post("/register", (req, res) => {
    try {
      const rawName = req.body && req.body.userName;
      const userName = typeof rawName === "string" ? rawName.trim() : "";
      if (!userName) {
        return res.status(400).json({ error: "ユーザー名を入力してください。" });
      }
      if (userName.length > 50) {
        return res
          .status(400)
          .json({ error: "ユーザー名は 50 文字以内で入力してください。" });
      }
      const { uuid, userName: name } = repo.createUser(userName);
      return res.status(201).json({ uuid, userName: name });
    } catch (err) {
      console.error("POST /api/user/register error:", err.message);
      return res
        .status(500)
        .json({ error: "ユーザー登録に失敗しました。もう一度お試しください。" });
    }
  });

  // GET /api/user/:uuid
  router.get("/:uuid", (req, res) => {
    try {
      const uuid = req.params.uuid;
      if (!uuid || typeof uuid !== "string") {
        return res.status(400).json({ error: "uuid が不正です。" });
      }
      const user = repo.getUser(uuid);
      if (!user) {
        return res.status(404).json({ error: "ユーザーが見つかりません。" });
      }
      // last_active_at を更新（失敗しても致命ではない）
      repo.touchUser(uuid);
      return res.json({
        uuid: user.uuid,
        userName: user.userName,
        lastActiveAt: user.lastActiveAt,
      });
    } catch (err) {
      console.error("GET /api/user/:uuid error:", err.message);
      return res.status(500).json({ error: "ユーザー取得に失敗しました。" });
    }
  });

  return router;
}

module.exports = { createUserRouter };
