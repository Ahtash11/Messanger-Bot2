const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { config } = require('./config');

// Uses Node's built-in SQLite (stable since Node 22.5, no npm package) —
// deliberately not better-sqlite3, since that needs a native build step
// (a C++ toolchain) that isn't guaranteed to be present wherever this runs,
// and this project's engines field only requires Node >=18. node:sqlite
// ships with the runtime itself, so there's nothing to compile anywhere.
//
// Falls back to a local file for local testing — same tradeoff as
// inventory.js's old SEED_FILE/LIVE_FILE split. In production this should
// always be set to a path on a Railway Volume (see config.databasePath).
const DB_PATH = config.databasePath || path.join(__dirname, 'data', 'store.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

// WAL mode lets reads and writes happen concurrently without blocking each
// other — matters here since the bot, the Telegram admin agent, and
// multiple POS devices can all be hitting the database around the same
// time.
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8'));

// better-sqlite3-style transaction helper (node:sqlite has no built-in
// equivalent) — every write in this project goes through this, so it's a
// single, well-tested chokepoint for "run this as one atomic unit" rather
// than each call site hand-rolling BEGIN/COMMIT/ROLLBACK.
db.transaction = function transaction(fn) {
  return function (...args) {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackErr) {
        console.error('db: rollback also failed:', rollbackErr.message);
      }
      throw err;
    }
  };
};

module.exports = db;
