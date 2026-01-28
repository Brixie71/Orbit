// utils/activity.js
const db = require("./db");

function touchMemberActivity(guildId, userId, atMs = Date.now()) {
  db.prepare(`
    INSERT INTO member_activity (guild_id, user_id, last_seen_ms)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      last_seen_ms = excluded.last_seen_ms
  `).run(guildId, userId, atMs);
}

function getMemberLastSeen(guildId, userId) {
  const row = db
    .prepare(`SELECT last_seen_ms FROM member_activity WHERE guild_id = ? AND user_id = ?`)
    .get(guildId, userId);
  return row?.last_seen_ms ?? null;
}

function listInactiveMembers(guildId, cutoffMs) {
  return db
    .prepare(`
      SELECT user_id, last_seen_ms
      FROM member_activity
      WHERE guild_id = ? AND last_seen_ms <= ?
      ORDER BY last_seen_ms ASC
    `)
    .all(guildId, cutoffMs);
}

module.exports = { touchMemberActivity, getMemberLastSeen, listInactiveMembers };
