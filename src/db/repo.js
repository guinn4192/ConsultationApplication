// src/db/repo.js
// DESIGN.md §5 / §6: CRUD + 特殊クエリ。
// すべて同期 API。プリペアードステートメントを使う（§7.4 セキュリティ）。

"use strict";

const { randomUUID } = require("crypto");

/**
 * @param {object} db - driver.js が返す DB オブジェクト
 */
function createRepo(db) {
  // ---- users ----
  const stInsertUser = db.prepare(
    `INSERT INTO users (uuid, user_name, created_at, last_active_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
  );
  const stGetUser = db.prepare(
    `SELECT uuid, user_name AS userName, created_at AS createdAt, last_active_at AS lastActiveAt
       FROM users WHERE uuid = ?`
  );
  const stTouchUser = db.prepare(
    `UPDATE users SET last_active_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE uuid = ?`
  );

  // ---- sessions ----
  const stInsertSession = db.prepare(
    `INSERT OR IGNORE INTO sessions (id, user_uuid, started_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
  );
  const stGetSession = db.prepare(
    `SELECT id, user_uuid AS userUuid, started_at AS startedAt, closed_at AS closedAt
       FROM sessions WHERE id = ?`
  );
  const stCloseSession = db.prepare(
    `UPDATE sessions
        SET closed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND user_uuid = ? AND closed_at IS NULL`
  );

  // Feature 21: 当日未 close の最新 1 件
  const stGetResumableSession = db.prepare(
    `SELECT id, user_uuid AS userUuid, started_at AS startedAt, closed_at AS closedAt
       FROM sessions
      WHERE user_uuid = ?
        AND closed_at IS NULL
        AND date(started_at) = date('now')
      ORDER BY started_at DESC
      LIMIT 1`
  );

  // 履歴: ユーザーの全セッション（新しい順）+ 先頭 user 発言プレビュー
  const stListSessions = db.prepare(
    `SELECT s.id AS sessionId,
            s.started_at AS startedAt,
            s.closed_at AS closedAt,
            (SELECT content FROM messages
               WHERE session_id = s.id AND role = 'user'
               ORDER BY created_at ASC LIMIT 1) AS preview
       FROM sessions s
      WHERE s.user_uuid = ?
      ORDER BY s.started_at DESC`
  );

  // ---- messages ----
  const stInsertMessage = db.prepare(
    `INSERT INTO messages (id, session_id, role, content, mode, category, created_at)
     VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
  );
  const stListMessages = db.prepare(
    `SELECT id, role, content, mode, category, created_at AS createdAt
       FROM messages
      WHERE session_id = ?
      ORDER BY created_at ASC`
  );

  // ---- emotion_records ----
  const stInsertEmotion = db.prepare(
    `INSERT INTO emotion_records (id, session_id, message_id, emoji_value, created_at)
     VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
  );
  const stListEmotions = db.prepare(
    `SELECT id, message_id AS messageId, emoji_value AS emojiValue, created_at AS createdAt
       FROM emotion_records
      WHERE session_id = ?
      ORDER BY created_at ASC`
  );

  return {
    // ---- users ----
    /**
     * 新規ユーザーを登録し { uuid, userName } を返す。
     */
    createUser(userName) {
      const uuid = randomUUID();
      stInsertUser.run(uuid, userName);
      return { uuid, userName };
    },

    getUser(uuid) {
      return stGetUser.get(uuid) || null;
    },

    touchUser(uuid) {
      try {
        stTouchUser.run(uuid);
      } catch (_) {
        // last_active_at 更新失敗は致命ではない
      }
    },

    // ---- sessions ----
    /**
     * 新規セッションを作成 or 既存を返す（冪等）。
     * @param {string} sessionId - クライアント採番の UUID
     * @param {string} userUuid
     * @returns {{ sessionId: string, startedAt: string }}
     */
    createSession(sessionId, userUuid) {
      stInsertSession.run(sessionId, userUuid);
      const row = stGetSession.get(sessionId);
      return {
        sessionId: row.id,
        startedAt: row.startedAt,
      };
    },

    getSession(sessionId) {
      return stGetSession.get(sessionId) || null;
    },

    /**
     * セッションを close（冪等）。
     * @returns {{ sessionId: string, closedAt: string, alreadyClosed: boolean }}
     */
    closeSession(sessionId, userUuid) {
      const res = stCloseSession.run(sessionId, userUuid);
      const changes = res && typeof res.changes === "number" ? res.changes : 0;
      const row = stGetSession.get(sessionId);
      if (!row || row.userUuid !== userUuid) {
        return null; // 呼び出し側で 404/403 判定
      }
      return {
        sessionId: row.id,
        closedAt: row.closedAt,
        alreadyClosed: changes === 0,
      };
    },

    /**
     * 当日未 close の最新セッションを 1 件取得し、関連する messages / emotions も一緒に返す。
     * 該当なしは null。
     */
    getResumableSession(userUuid) {
      const session = stGetResumableSession.get(userUuid);
      if (!session) return null;
      const messages = stListMessages.all(session.id);
      const emotions = stListEmotions.all(session.id);
      return {
        session: {
          id: session.id,
          startedAt: session.startedAt,
          closedAt: session.closedAt,
        },
        messages,
        emotions,
      };
    },

    // ---- messages ----
    /**
     * ユーザー / アシスタント発言を INSERT。
     * @param {{id, sessionId, role, content, mode, category}} m
     */
    insertMessage(m) {
      stInsertMessage.run(
        m.id,
        m.sessionId,
        m.role,
        m.content,
        m.mode == null ? null : String(m.mode),
        m.category == null ? null : String(m.category)
      );
    },

    // ---- emotions ----
    /**
     * 絵文字を INSERT（append-only）。
     */
    insertEmotion({ sessionId, messageId, emojiValue }) {
      const id = randomUUID();
      stInsertEmotion.run(id, sessionId, messageId || null, emojiValue);
      const rows = stListEmotions.all(sessionId);
      const inserted = rows.find((r) => r.id === id) || null;
      return {
        id,
        createdAt: inserted ? inserted.createdAt : new Date().toISOString(),
      };
    },

    // ---- history ----
    /**
     * ユーザーの全セッション一覧（新しい順）。
     */
    listSessionsByUser(userUuid) {
      return stListSessions.all(userUuid);
    },

    /**
     * セッション詳細（messages + emotions）。user_uuid 一致チェック込み。
     */
    getSessionDetail(sessionId, userUuid) {
      const row = stGetSession.get(sessionId);
      if (!row) return null;
      if (row.userUuid !== userUuid) return { forbidden: true };
      const messages = stListMessages.all(sessionId);
      const emotions = stListEmotions.all(sessionId);
      return {
        session: {
          id: row.id,
          startedAt: row.startedAt,
          closedAt: row.closedAt,
        },
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          mode: m.mode,
          category: m.category,
          createdAt: m.createdAt,
        })),
        emotions: emotions.map((e) => ({
          id: e.id,
          messageId: e.messageId,
          emojiValue: e.emojiValue,
          createdAt: e.createdAt,
        })),
      };
    },
  };
}

module.exports = { createRepo };
