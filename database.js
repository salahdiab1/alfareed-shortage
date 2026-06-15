const Database = require('better-sqlite3');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const db = new Database(path.join(DATA_DIR, 'alfareed.db'));

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
    status      TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'closed')),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    closed_at   DATETIME
  );
`);

// Migrations
try { db.exec("ALTER TABLE reports ADD COLUMN closed_at DATETIME"); } catch {}
try { db.exec("ALTER TABLE reports ADD COLUMN inspected_at DATETIME"); } catch {}
try {
  // Recreate table only if CHECK constraint doesn't allow 'closed'
  db.prepare("INSERT INTO reports(worker_name,product,quantity,priority,status) VALUES('_test','_test',1,'normal','closed')").run();
  db.prepare("DELETE FROM reports WHERE worker_name='_test'").run();
} catch {
  db.exec(`
    BEGIN;
    CREATE TABLE IF NOT EXISTS reports_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT, worker_name TEXT NOT NULL, product TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity>0), priority TEXT NOT NULL CHECK(priority IN ('urgent','normal')),
      photo_path TEXT, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','closed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, resolved_at DATETIME, closed_at DATETIME
    );
    INSERT INTO reports_v2 SELECT id,worker_name,product,quantity,priority,photo_path,status,created_at,resolved_at,NULL FROM reports;
    DROP TABLE reports;
    ALTER TABLE reports_v2 RENAME TO reports;
    COMMIT;
  `);
}

module.exports = db;
