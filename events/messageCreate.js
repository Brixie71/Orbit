// events/messageCreate.js
const { Events, PermissionFlagsBits, EmbedBuilder, escapeMarkdown } = require("discord.js");
const config = require("../config");
const { getGuildSettings } = require("../utils/guildSettings");
const { touchMemberActivity } = require("../utils/activity");
const { findWordSimilarity } = require("../utils/vectraWordBlocker");

const ORBIT_MOD_FLAG = Symbol.for("orbit.linkguardHandled");

function isUnknownMessageError(err) {
  return err?.code === 10008 || err?.rawError?.code === 10008;
}

function isCannotDmUserError(err) {
  return err?.code === 50007 || err?.rawError?.code === 50007;
}

async function tryDeleteMessage(message) {
  try {
    await message.delete();
    return true;
  } catch (err) {
    if (!isUnknownMessageError(err)) {
      console.error("messageCreate delete failed:", err);
    }
    return false;
  }
}

async function tryDmBlockedUser(message, reasonText) {
  const dmOnBlock = config.linkguard?.dmUserOnBlock === true;
  if (!dmOnBlock) return;

  const guildName = message.guild?.name || "this server";
  try {
    await message.author.send(
      `Your message in **${guildName}** was removed by WordBlocker (${reasonText}).`
    );
  } catch (err) {
    if (!isCannotDmUserError(err)) {
      console.error("messageCreate DM failed:", err);
    }
  }
}

function formatDiscordDateTime(ms) {
  const unix = Math.floor((ms || Date.now()) / 1000);
  return `<t:${unix}:F> | <t:${unix}:R>`;
}

function buildViolatorContact(user) {
  const safeId = user?.id || "0";
  const label = escapeMarkdown(user?.tag || user?.username || "Unknown");
  return `<@${safeId}>`;
}

function sanitizeWordValue(word) {
  const value = String(word || "").trim().replace(/`/g, "");
  return value || "unknown";
}

function buildWordBlockerViolationEmbed(message, payload) {
  const sentAt = message.createdTimestamp || Date.now();
  const word = sanitizeWordValue(payload?.word);
  const scorePct = Math.round((payload?.score || 0) * 100);
  const scoreSuffix = Number.isFinite(scorePct) ? ` (${scorePct}% match)` : "";

  return new EmbedBuilder()
    .setColor(config.theme?.WARNING || "#FACC15")
    .setTitle("WordBlocker Violation")
    .setDescription("A blocked word/similar phrase was detected. Please review.")
    .addFields(
      { name: "Violator", value: buildViolatorContact(message.author), inline: true },
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
      { name: "Date and Time", value: formatDiscordDateTime(sentAt), inline: false },
      { name: "Word", value: `\`${word}\`${scoreSuffix}`, inline: false }
    );
}

async function sendViolationLog(message, payload) {
  const logChannelId = config.linkguard?.violationLogChannelId;
  if (!logChannelId) return;

  try {
    const channel =
      message.guild.channels.cache.get(logChannelId) ||
      (await message.guild.channels.fetch(logChannelId).catch(() => null));

    if (!channel || !channel.isTextBased()) return;
    const embed = buildWordBlockerViolationEmbed(message, payload);
    await channel.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  } catch (err) {
    console.error("messageCreate log send failed:", err);
  }
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;
    if (message[ORBIT_MOD_FLAG]) return;

    // Track "last seen" on any message
    touchMemberActivity(message.guildId, message.author.id, Date.now());

    // Anti-spam / WordBlocker only when enabled per guild
    const settings = getGuildSettings(message.guildId);
    if (!settings?.antispam_enabled) return;

    // Optional bypass for mods/admins
    const member = message.member;
    const bypassManageMessages = config.antispam?.bypassManageMessages ?? true;
    if (bypassManageMessages && member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return;

    // Tunables
    const WINDOW_MS = 6000;
    const MAX_MSG = 5;
    const DUP_MS = 15000;
    const MAX_DUP = 3;

    const spam = message.client._orbitSpam || (message.client._orbitSpam = new Map());
    const key = `${message.guildId}:${message.author.id}`;

    const now = Date.now();
    const entry = spam.get(key) || {
      times: [],
      lastText: "",
      dupCount: 0,
      lastDupAt: 0,
    };

    entry.times = entry.times.filter((t) => now - t < WINDOW_MS);
    entry.times.push(now);

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
    const semanticHit =
      !isFlood && !isDupSpam ? await findWordSimilarity(text).catch(() => null) : null;
    const isSemanticSpam = !!semanticHit;

    if (!isFlood && !isDupSpam && !isSemanticSpam) return;

    const warnInChannel = config.linkguard?.warnInChannel !== false;
    const ttl =
      config.linkguard?.warnDeleteAfterMs ??
      config.antispam?.warnDeleteAfterMs ??
      5000;

    message[ORBIT_MOD_FLAG] = true;
    await tryDeleteMessage(message);

    const reason = isFlood
      ? "message flooding"
      : isDupSpam
      ? "duplicate spam"
      : `word-similarity match (${Math.round((semanticHit?.score || 0) * 100)}%)`;

    await tryDmBlockedUser(message, reason);

    if (isSemanticSpam) {
      await sendViolationLog(message, {
        word: semanticHit?.phrase || text,
        score: semanticHit?.score || 0,
      });
    }

    if (warnInChannel) {
      try {
        const warn = await message.channel.send({
          content: `⚠️ ${message.author} WordBlocker triggered (**${reason}**). Please be appropriate.`,
        });
        setTimeout(() => warn.delete().catch(() => {}), ttl);
      } catch (sendErr) {
        console.error("messageCreate warn send failed:", sendErr);
      }
    }
  },
};
