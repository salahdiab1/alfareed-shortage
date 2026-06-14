const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'alfareed.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_name TEXT    NOT NULL,
    product     TEXT    NOT NULL,
    quantity    INTEGER NOT NULL CHECK(quantity > 0),
    priority    TEXT    NOT NULL CHECK(priority IN ('urgent', 'normal')),
    photo_path  TEXT,
    status      TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved')),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
  );
`);

module.exports = db;
