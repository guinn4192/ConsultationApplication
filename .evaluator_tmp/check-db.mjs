import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/app.db');
const args = process.argv.slice(2);
const query = args[0] || 'summary';

if (query === 'summary') {
  console.log('--- users ---');
  console.log(db.prepare('SELECT uuid, user_name, created_at FROM users').all());
  console.log('--- sessions ---');
  console.log(db.prepare('SELECT id, user_uuid, started_at, closed_at FROM sessions ORDER BY started_at DESC').all());
  console.log('--- messages ---');
  console.log(db.prepare('SELECT id, session_id, role, substr(content, 1, 50) as preview, mode, category, created_at FROM messages ORDER BY created_at').all());
  console.log('--- emotion_records ---');
  console.log(db.prepare('SELECT id, session_id, message_id, emoji_value, created_at FROM emotion_records ORDER BY created_at').all());
} else if (query === 'schema') {
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
  for (const t of tables) console.log(t.name + ':\n' + t.sql + '\n');
  const idx = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all();
  console.log('--- indexes ---');
  for (const i of idx) console.log(i.name, '->', i.tbl_name, ':', i.sql);
}
db.close();
