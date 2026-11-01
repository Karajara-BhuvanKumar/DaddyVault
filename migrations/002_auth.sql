-- Owner authentication; financial data remains one atomic workspace.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  csrf TEXT NOT NULL,
  expires INTEGER NOT NULL,
  credential TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires);
CREATE TABLE IF NOT EXISTS login_attempts (attempted_at INTEGER NOT NULL);
PRAGMA user_version = 2;
