// events/messageCreate.js
const { Events, PermissionFlagsBits } = require("discord.js");
const { getGuildSettings } = require("../utils/guildSettings");

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    // =========================
    // 1) ANTI-SPAM (FIRST)
    // =========================
    const settings = getGuildSettings(message.guildId);
    if (settings?.antispam_enabled) {
      // Optional bypass for mods/admins
      const member = message.member;
      if (!member?.permissions?.has(PermissionFlagsBits.ManageMessages)) {
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

        if (isFlood || isDupSpam) {
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

          // IMPORTANT: don't let TTS read spam that we deleted
          return;
        }
      }
    }

    // =========================
    // 2) TTS AUTO-READ (SECOND)
    // =========================
    const tts = message.client.tts;
    if (!tts) return;

    // Must be following a channel
    const followChannelId = tts.getFollowChannel?.(message.guildId);
    if (!followChannelId || followChannelId !== message.channelId) return;

    // Must be connected to VC
    if (!tts.isConnected?.(message.guildId)) return;

    // Filters (keep it sane)
    const raw = (message.content || "").trim();
    if (!raw) return;

    // Hard caps + common noise filters
    if (raw.length > 180) return;
    if (/^https?:\/\//i.test(raw)) return;
    if (raw.includes("@everyone") || raw.includes("@here")) return;

    // Rate limit (per user + guild) handled by TTSManager
    if (!tts.allow?.(message.guildId, message.author.id)) return;

    // Light cleanup to reduce Discord markup noise
    const cleaned = raw
      .replace(/`{1,3}[\s\S]*?`{1,3}/g, "")     // strip inline/code blocks
      .replace(/<@!?(\d+)>/g, "mention")        // user mentions
      .replace(/<@&(\d+)>/g, "role")            // role mentions
      .replace(/<#(\d+)>/g, "channel")          // channel mentions
      .replace(/\*\*([^*]+)\*\*/g, "$1")        // bold
      .replace(/\*([^*]+)\*/g, "$1")            // italics
      .trim();

    if (!cleaned) return;

    // Enqueue speech (FIFO queue, no overlap)
    await tts.enqueue?.({
      guildId: message.guildId,
      text: cleaned,
    });
  },
};
