// utils/db.js
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(process.cwd(), "./data/orbit.sqlite");
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  antispam_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- NEW: per-user activity tracking (Orbit "last seen")
CREATE TABLE IF NOT EXISTS member_activity (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_seen_ms INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);
`);

module.exports = db;
