// events/domainFilter.js
const { Events } = require("discord.js");
const {
  findBlacklistedInMessage,
  extractUrls,
  normalizeUrl,
  getDomainFromUrl
} = require("../utils/domainBlocker");
const { isDomainWhitelisted } = require("../utils/whitelistManager");
const store = require("../utils/linkguardStore");

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;

      const content = message.content || "";

      // 1) Always block blacklisted domains (regardless of LinkGuard on/off)
      const hit = findBlacklistedInMessage(content);
      if (hit) {
        await message.delete().catch(() => {});
        const matchLabel = hit.matchType === "path" ? "link" : "domain";
        const matchValue = hit.match || hit.domain;

        await message.author
          .send(`⚠️ Your message was removed. Blacklisted ${matchLabel} detected: \`${matchValue}\`, Dont do that again! or I'll Mute you until 12/31/2099. Try me. Orbit System Out!`)
          .catch(() => {});

        await message.channel
          .send(`🛡️ ${message.author} blacklisted ${matchLabel} blocked.`)
          .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
          .catch(() => {});
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

      const member = message.member;
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

      await message.delete().catch(() => {});

      // Keep the warning short to avoid spam
      await message.channel
        .send(`🛡️ ${message.author} links are blocked here. Use approved media links only.`)
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
        .catch(() => {});
    } catch (err) {
      console.error("domainFilter error:", err);
    }
  }
};
