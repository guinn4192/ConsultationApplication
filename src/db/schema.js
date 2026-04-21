// src/db/schema.js
// DESIGN.md §5.2 / §5.3 / §5.4 / §7.7:
//   - CREATE TABLE IF NOT EXISTS × 4 (users / sessions / messages / emotion_records)
//   - CREATE INDEX IF NOT EXISTS × 3
//   - PRAGMA journal_mode = WAL / foreign_keys = ON / synchronous = NORMAL
//   - 起動時: 前日以前の未 close セッションを自動 close（orphan close）

"use strict";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  uuid TEXT PRIMARY KEY,
  user_name TEXT NOT NULL CHECK(length(user_name) BETWEEN 1 AND 50),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_active_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_uuid TEXT NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  mode TEXT,
  category TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emotion_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  emoji_value INTEGER NOT NULL CHECK(emoji_value BETWEEN 1 AND 5),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON sessions(user_uuid, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_emotion_session_created ON emotion_records(session_id, created_at);
`;

/**
 * DB を初期化する。
 * 1. PRAGMA を設定
 * 2. テーブル・インデックス作成
 * 3. 前日以前の未 close セッションを自動 close
 * @param {object} db - driver.js が返す DB オブジェクト
 * @returns {{ orphanClosed: number }}
 */
function initSchema(db) {
  // PRAGMA — driver 層で exec 経由に統一
  try {
    db.pragma("journal_mode = WAL");
  } catch (_) {
    // journal_mode 設定失敗しても致命ではない
  }
  try {
    db.pragma("foreign_keys = ON");
  } catch (_) {}
  try {
    db.pragma("synchronous = NORMAL");
  } catch (_) {}

  db.exec(SCHEMA_SQL);

  // Orphan close: 前日以前の未 close セッションを自動的に close する（§7.7）
  const stmt = db.prepare(
    `UPDATE sessions
       SET closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE closed_at IS NULL
       AND date(started_at) < date('now')`
  );
  const res = stmt.run();
  const orphanClosed = res && typeof res.changes === "number" ? res.changes : 0;
  return { orphanClosed };
}

module.exports = { initSchema };
