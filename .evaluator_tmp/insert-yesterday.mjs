import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/app.db');
const uuid = process.argv[2];
if (!uuid) { console.error('usage: node insert-yesterday.mjs <userUuid>'); process.exit(1); }
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const sid = crypto.randomUUID();
db.prepare('INSERT INTO sessions (id, user_uuid, started_at, closed_at) VALUES (?, ?, ?, NULL)').run(sid, uuid, yesterday.toISOString());
db.prepare('INSERT INTO messages (id, session_id, role, content, mode, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), sid, 'user', '昨日の未完了メッセージ', 'default', null, yesterday.toISOString());
console.log('inserted yesterday session:', sid);
db.close();
