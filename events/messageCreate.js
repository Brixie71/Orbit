// events/messageCreate.js
const { Events, PermissionFlagsBits } = require("discord.js");
const { getGuildSettings } = require("../utils/guildSettings");

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const settings = getGuildSettings(message.guildId);
    if (!settings?.antispam_enabled) return;

    // Optional bypass for mods/admins
    const member = message.member;
    if (member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return;

    // Tunables
    const WINDOW_MS = 6000;   // rolling window
    const MAX_MSG = 5;        // max messages in window
    const DUP_MS = 15000;     // duplicate window
    const MAX_DUP = 3;        // duplicate count

    // State store (memory)
    const spam = message.client._orbitSpam || (message.client._orbitSpam = new Map());
    const key = `${message.guildId}:${message.author.id}`;

    const now = Date.now();
    const entry = spam.get(key) || {
      times: [],
      lastText: "",
      dupCount: 0,
      lastDupAt: 0,
    };

    // Flood detection
    entry.times = entry.times.filter((t) => now - t < WINDOW_MS);
    entry.times.push(now);

    // Duplicate detection
    const text = (message.content || "").trim();
    if (text && text === entry.lastText && now - entry.lastDupAt < DUP_MS) {
      entry.dupCount += 1;
      entry.lastDupAt = now;
    } else {
      entry.lastText = text;
      entry.dupCount = 1;
      entry.lastDupAt = now;
    }

    spam.set(key, entry);

    const isFlood = entry.times.length > MAX_MSG;
    const isDupSpam = text && entry.dupCount >= MAX_DUP;

    if (!isFlood && !isDupSpam) return;

    // Action
    try {
      await message.delete();
    } catch {
      return; // missing perms
    }

    const reason = isFlood ? "message flooding" : "duplicate spam";

    try {
      const warn = await message.channel.send({
        content: `⚠️ ${message.author} anti-spam triggered (**${reason}**). Slow down.`,
      });
      setTimeout(() => warn.delete().catch(() => {}), 5000);
    } catch {}
  },
};
