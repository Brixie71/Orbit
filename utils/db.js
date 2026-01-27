// utils/db.js
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(process.cwd(), "./data/orbit.sqlite");
const db = new Database(dbPath);

// Migrations (create tables if missing)
db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  antispam_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
`);

module.exports = db;
