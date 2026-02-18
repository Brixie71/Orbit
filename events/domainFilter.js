// events/domainFilter.js
const { Events, EmbedBuilder, PermissionFlagsBits, escapeMarkdown } = require("discord.js");
const config = require("../config");
const {
  findBlacklistedInMessage,
  extractUrls,
  normalizeUrl,
  getDomainFromUrl
} = require("../utils/domainBlocker");
const { isDomainWhitelisted } = require("../utils/whitelistManager");
const store = require("../utils/linkguardStore");

const ORBIT_MOD_FLAG = Symbol.for("orbit.linkguardHandled");

function isUnknownMessageError(err) {
  return err?.code === 10008 || err?.rawError?.code === 10008;
}

function isCannotDmUserError(err) {
  return err?.code === 50007 || err?.rawError?.code === 50007;
}

async function tryDeleteMessage(message, source) {
  try {
    await message.delete();
    return true;
  } catch (err) {
    if (!isUnknownMessageError(err)) {
      console.error(`${source} delete failed:`, err);
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
      `Your message in **${guildName}** was removed by LinkGuard (${reasonText}).`
    );
  } catch (err) {
    if (!isCannotDmUserError(err)) {
      console.error("domainFilter DM failed:", err);
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
  return `<@${safeId}>\n[Open Profile / DM](${`https://discord.com/users/${safeId}`})\n\`${label}\``;
}

function censorLinkForDisplay(url) {
  const value = String(url || "").trim();
  if (!value) return "unknown";
  return value
    .replace(/^https:\/\//i, "hxxps://")
    .replace(/^http:\/\//i, "hxxp://")
    .replace(/\./g, "[.]");
}

function formatCopyableLink(url) {
  const value = String(url || "").trim() || "unknown";
  return `||\`${value.replace(/`/g, "")}\`||`;
}

function buildLinkguardViolationEmbed(message, payload) {
  const sentAt = message.createdTimestamp || Date.now();
  const blockedUrl = payload?.blockedUrl || "";
  const safeDisplay = censorLinkForDisplay(blockedUrl);
  const reasonText = payload?.reasonText || "Blocked link detected.";
  const titleText = payload?.title || "LinkGuard Violation";

  return new EmbedBuilder()
    .setColor(config.theme?.ERROR || "#EF4444")
    .setTitle(titleText)
    .setDescription(reasonText)
    .addFields(
      { name: "Violator", value: buildViolatorContact(message.author), inline: true },
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
      { name: "Date and Time", value: formatDiscordDateTime(sentAt), inline: false },
      {
        name: "Link",
        value: `Display: \`${safeDisplay}\`\nCopy: ${formatCopyableLink(blockedUrl)}`,
        inline: false,
      }
    );
}

async function resolveLogChannel(message, logChannelId) {
  if (!logChannelId) return null;

  const channel =
    message.client.channels.cache.get(logChannelId) ||
    (await message.client.channels.fetch(logChannelId).catch(() => null));

  if (!channel) {
    console.error(
      `domainFilter log channel not found: ${logChannelId} (guild=${message.guildId})`
    );
    return null;
  }

  if (!channel.isTextBased()) {
    console.error(`domainFilter log channel is not text-based: ${logChannelId}`);
    return null;
  }

  if (channel.guildId && channel.guildId !== message.guildId) {
    console.error(
      `domainFilter log channel is in a different guild: channelGuild=${channel.guildId} messageGuild=${message.guildId}`
    );
    return null;
  }

  return channel;
}

async function sendViolationLog(message, payload) {
  const logChannelId = config.linkguard?.violationLogChannelId;
  if (!logChannelId) return;

  try {
    const channel = await resolveLogChannel(message, logChannelId);
    if (!channel) return;
    const perms = channel.permissionsFor(message.guild?.members?.me);
    const missingPerms = [];
    if (!perms?.has(PermissionFlagsBits.ViewChannel)) missingPerms.push("ViewChannel");
    if (!perms?.has(PermissionFlagsBits.SendMessages)) missingPerms.push("SendMessages");
    if (!perms?.has(PermissionFlagsBits.EmbedLinks)) missingPerms.push("EmbedLinks");
    if (missingPerms.length > 0) {
      console.error(
        `domainFilter missing log channel permissions (${logChannelId}): ${missingPerms.join(", ")}`
      );
      return;
    }

    const embed = buildLinkguardViolationEmbed(message, payload);
    await channel.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  } catch (err) {
    console.error("domainFilter log send failed:", err);
  }
}

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (message[ORBIT_MOD_FLAG]) return;

      const content = message.content || "";
      const member = message.member;
      const warnInChannel = config.linkguard?.warnInChannel !== false;
      const warnDeleteAfterMs = config.linkguard?.warnDeleteAfterMs ?? 5000;

      // 1) Always block blacklisted domains (regardless of LinkGuard on/off)
      const hit = findBlacklistedInMessage(content);
      if (hit) {
        message[ORBIT_MOD_FLAG] = true;
        await tryDeleteMessage(message, "domainFilter blacklisted");
        await tryDmBlockedUser(message, "blacklisted domain");

        await sendViolationLog(message, {
          blockedUrl: hit?.url || "",
          title: "LinkGuard Violation",
          reasonText: "A blacklisted domain was blocked. Please review.",
        });

        if (warnInChannel) {
          await message.channel
            .send("The link you sent is a blacklisted domain.")
            .then((m) => setTimeout(() => m.delete().catch(() => {}), warnDeleteAfterMs))
            .catch((sendErr) => console.error("domainFilter blacklisted warn send failed:", sendErr));
        }
        return;
      }

      // 2) LinkGuard ON/OFF logic
      const guildId = message.guild.id;
      const channelId = message.channel.id;

      const serverEnabled = store.isServerEnabled(guildId);
      const channelOverride = store.isChannelEnabled(guildId, channelId); // true/false/null
      const effectiveEnabled =
        channelOverride === null ? serverEnabled : channelOverride;

      if (!effectiveEnabled) return;
      if (!member) return;

      const exemptRoles = store.getExemptRoles(guildId);
      const restrictRoles = store.getRestrictRoles(guildId);

      // Exempt roles bypass completely
      if ([...exemptRoles].some((rid) => member.roles.cache.has(rid))) return;

      // If restrictRoles has entries: ONLY block those roles; everyone else allowed
      if (restrictRoles.size > 0) {
        const isRestricted = [...restrictRoles].some((rid) => member.roles.cache.has(rid));
        if (!isRestricted) return;
      }

      // 3) Detect URLs and allow whitelisted domains only
      const urls = extractUrls(content)
        .map(normalizeUrl)
        .filter(Boolean);

      if (urls.length === 0) return;

      const nonWhitelisted = urls.filter((u) => {
        const d = getDomainFromUrl(u);
        if (!d) return false;
        return !isDomainWhitelisted(d);
      });

      if (nonWhitelisted.length === 0) return;

      message[ORBIT_MOD_FLAG] = true;
      await tryDeleteMessage(message, "domainFilter allowlist");
      await tryDmBlockedUser(message, "unapproved link");

      await sendViolationLog(message, {
        blockedUrl: nonWhitelisted[0] || "",
        title: "LinkGuard Allowlist Block",
        reasonText: "A non-whitelisted link was blocked by LinkGuard.",
      });

      if (warnInChannel) {
        await message.channel
          .send(`LinkGuard blocked a link from ${message.author}. Use approved media links only.`)
          .then((m) => setTimeout(() => m.delete().catch(() => {}), warnDeleteAfterMs))
          .catch((sendErr) => console.error("domainFilter allowlist warn send failed:", sendErr));
      }
    } catch (err) {
      console.error("domainFilter error:", err);
    }
  }
};
