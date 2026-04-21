// src/db/driver.js
// DESIGN.md §1.1: better-sqlite3 第1候補 / node:sqlite フォールバック抽象化。
//
// 呼び出し側（repo.js / schema.js）は以下のインタフェースにのみ依存する:
//   db.exec(sql)                      … 複数ステートメント一括実行
//   db.prepare(sql).run(...params)    … INSERT/UPDATE/DELETE（{ changes, lastInsertRowid }）
//   db.prepare(sql).get(...params)    … 単行 SELECT
//   db.prepare(sql).all(...params)    … 複数行 SELECT
//   db.pragma(pragmaString)           … better-sqlite3 API 相当（node:sqlite では exec で代替）
//
// Windows 環境で Visual Studio がない場合、better-sqlite3 のネイティブビルドが
// 失敗する。その場合 Node 22+ の組込 `node:sqlite`（DatabaseSync）へフォールバックする。

"use strict";

const path = require("path");
const fs = require("fs");

/**
 * DB インスタンスを開いて返す。
 * @param {string} filePath - SQLite ファイルパス（ディレクトリは自動作成）
 * @returns {{
 *   impl: "better-sqlite3" | "node:sqlite",
 *   exec: (sql: string) => void,
 *   prepare: (sql: string) => { run: Function, get: Function, all: Function },
 *   pragma: (s: string) => any,
 *   close: () => void,
 *   raw: any,
 * }}
 */
function openDb(filePath) {
  // ディレクトリがなければ作る
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // --- 1st choice: better-sqlite3 ---
  let betterErr = null;
  try {
    const Better = require("better-sqlite3");
    const raw = new Better(filePath);
    return {
      impl: "better-sqlite3",
      exec: (sql) => raw.exec(sql),
      prepare: (sql) => {
        const stmt = raw.prepare(sql);
        return {
          run: (...params) => stmt.run(...params),
          get: (...params) => stmt.get(...params),
          all: (...params) => stmt.all(...params),
        };
      },
      pragma: (s) => raw.pragma(s),
      close: () => raw.close(),
      raw,
    };
  } catch (err) {
    betterErr = err;
  }

  // --- 2nd choice: node:sqlite (Node 22+) ---
  try {
    // node:sqlite は ExperimentalWarning を出すのでロード時に限定的に抑制する。
    // （一度だけロードすれば以降の呼び出しでは再度出ない）
    const origEmit = process.emitWarning;
    process.emitWarning = function (warning, type) {
      if (type === "ExperimentalWarning" && typeof warning === "string" && /SQLite/i.test(warning)) {
        return;
      }
      return origEmit.apply(process, arguments);
    };
    let DatabaseSync;
    try {
      // node: プレフィックスは Node 組込モジュール
      ({ DatabaseSync } = require("node:sqlite"));
    } finally {
      process.emitWarning = origEmit;
    }
    const raw = new DatabaseSync(filePath);
    return {
      impl: "node:sqlite",
      exec: (sql) => raw.exec(sql),
      prepare: (sql) => {
        const stmt = raw.prepare(sql);
        return {
          run: (...params) => {
            // node:sqlite の StatementSync.run() の戻りは { changes, lastInsertRowid }
            // という形ですでに互換（Node v22 以降）
            return stmt.run(...params);
          },
          get: (...params) => stmt.get(...params),
          all: (...params) => stmt.all(...params),
        };
      },
      // node:sqlite は pragma() メソッドを持たないため exec で代替
      pragma: (s) => {
        // better-sqlite3 は "journal_mode = WAL" のように key = value または key のみを受ける。
        // 戻り値は配列（例: [{journal_mode:"wal"}]）だが、本プロジェクトでは利用していないので
        // 単に exec で PRAGMA 文を流すだけで足りる。
        raw.exec(`PRAGMA ${s};`);
        return null;
      },
      close: () => raw.close(),
      raw,
    };
  } catch (err) {
    // 両方失敗 → 上位に通知
    const e = new Error(
      "SQLite driver unavailable. Tried better-sqlite3 and node:sqlite.\n" +
        "  better-sqlite3 error: " +
        (betterErr && betterErr.message) +
        "\n  node:sqlite error: " +
        err.message
    );
    e.cause = err;
    throw e;
  }
}

module.exports = { openDb };
