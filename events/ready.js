// events/ready.js
const { ActivityType, AttachmentBuilder, PermissionsBitField } = require("discord.js");
const path = require("path");

const config = require("../config");
const { createStyledEmbed } = require("../utils/embedCreator");
const { listInactiveMembers, getMemberLastSeen } = require("../utils/activity");

function safeAttach(filePath, name) { /* keep your existing safeAttach */ }

// helper: ensure role exists
async function ensureInactiveRole(guild, roleName) {
  const existing = guild.roles.cache.find(r => r.name === roleName);
  if (existing) return existing;

  // needs ManageRoles permission for bot
  return guild.roles.create({
    name: roleName,
    reason: "Orbit inactivity role auto-created"
  });
}

function withPrefix(name, prefix) {
  if (!name) return prefix.trim();
  return name.startsWith(prefix) ? name : `${prefix}${name}`;
}

function stripPrefix(name, prefix) {
  if (!name) return name;
  return name.startsWith(prefix) ? name.slice(prefix.length).trimStart() : name;
}

async function scanGuildForInactive(guild) {
  const cfg = config.inactivity || {};
  if (!cfg.enabled) return;

  const thresholdDays = cfg.thresholdDays ?? 30;
  const prefix = cfg.nicknamePrefix ?? "INACTIVE | ";
  const roleName = cfg.roleName ?? "INACTIVE";

  const cutoffMs = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;

  // Ensure role
  const inactiveRole = await ensureInactiveRole(guild, roleName).catch(() => null);
  if (!inactiveRole) return;

  // Pull “known last seen” members
  const rows = listInactiveMembers(guild.id, cutoffMs);

  // We’ll also do a light “reactivation” check for members who have the role but are now active
  const botMe = guild.members.me;

  // Bot needs: ManageNicknames + ManageRoles (and role must be below bot's top role)
  const canNick =
    botMe?.permissions?.has(PermissionsBitField.Flags.ManageNicknames);
  const canRoles =
    botMe?.permissions?.has(PermissionsBitField.Flags.ManageRoles);

  if (!canRoles) return;

  // Mark inactive
  for (const r of rows) {
    const member = await guild.members.fetch(r.user_id).catch(() => null);
    if (!member || member.user.bot) continue;

    if (!member.roles.cache.has(inactiveRole.id)) {
      await member.roles.add(inactiveRole, "Marked inactive by Orbit").catch(() => {});
    }

    if (canNick) {
      const baseName = member.nickname ?? member.user.username;
      const nextNick = withPrefix(baseName, prefix).slice(0, 32);
      if ((member.nickname ?? member.user.username) !== nextNick) {
        await member.setNickname(nextNick, "Marked inactive by Orbit").catch(() => {});
      }
    }
  }

  // Reactivate: remove role/prefix if last_seen is recent
  const membersWithRole = inactiveRole.members;
  for (const member of membersWithRole.values()) {
    if (member.user.bot) continue;

    const lastSeen = getMemberLastSeen(guild.id, member.id);
    if (lastSeen && lastSeen > cutoffMs) {
      await member.roles.remove(inactiveRole, "Reactivated by Orbit").catch(() => {});
      if (canNick) {
        const current = member.nickname ?? member.user.username;
        const nextNick = stripPrefix(current, prefix).slice(0, 32);
        if ((member.nickname ?? member.user.username) !== nextNick) {
          await member.setNickname(nextNick, "Reactivated by Orbit").catch(() => {});
        }
      }
    }
  }
}

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    client.user.setActivity(config.bot.activity, { type: ActivityType.Watching });

    // keep your existing startup embed logic...

    // ✅ NEW: inactivity scan scheduler
    const icfg = config.inactivity || {};
    if (icfg.enabled) {
      const everyMs = (icfg.scanEveryMinutes ?? 60) * 60_000;

      setInterval(async () => {
        for (const guild of client.guilds.cache.values()) {
          await scanGuildForInactive(guild);
        }
      }, everyMs).unref();
    }
  },
};
