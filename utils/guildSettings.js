// utils/guildSettings.js
const db = require("./db");

function getGuildSettings(guildId) {
  return db
    .prepare("SELECT guild_id, antispam_enabled, updated_at FROM guild_settings WHERE guild_id = ?")
    .get(guildId) || { guild_id: guildId, antispam_enabled: 0, updated_at: 0 };
}

function setAntiSpam(guildId, enabled) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO guild_settings (guild_id, antispam_enabled, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      antispam_enabled = excluded.antispam_enabled,
      updated_at = excluded.updated_at
  `).run(guildId, enabled ? 1 : 0, now);

  return enabled;
}

module.exports = { getGuildSettings, setAntiSpam };
