-- One validated aggregate is committed atomically. Record links are validated
-- by dist/ledger.js on every read/write, not by JSON foreign-key constraints.
CREATE TABLE IF NOT EXISTS workspace (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revisions (
  revision INTEGER PRIMARY KEY,
  payload TEXT NOT NULL,
  saved_at TEXT NOT NULL
);
PRAGMA user_version = 1;
