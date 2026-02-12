// commands/linkguard.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const store = require("../utils/linkguardStore");
const {
  addDomainToBlacklist,
  removeDomainFromBlacklist,
  loadBlacklistedDomains,
  analyzeURL
} = require("../utils/domainBlocker");
const { loadWhitelistedDomains } = require("../utils/whitelistManager");

function normDomain(input) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("linkguard")
    .setDescription("LinkGuard: block links + manage blacklist.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand((s) =>
        s.setName("status")
         .setDescription("Show LinkGuard settings.")
      )
      
      .addSubcommand((s) =>
        s.setName("activate")
         .setDescription("Enable/disable LinkGuard server-wide.")
         .addBooleanOption((o) =>
           o.setName("enabled").setDescription("true=ON, false=OFF").setRequired(true)
         )
      )
      
      .addSubcommand((s) =>
        s.setName("channel")
         .setDescription("Set LinkGuard for a channel.")
         .addChannelOption((o) =>
           o.setName("channel").setDescription("Target channel").setRequired(true)
         )
         .addBooleanOption((o) =>
           o.setName("enabled").setDescription("true=ON, false=OFF").setRequired(true)
         )
      )
      
      .addSubcommand((s) =>
        s.setName("exempt")
         .setDescription("Roles that can always post links.")
         .addRoleOption((o) => o.setName("role1").setDescription("Role").setRequired(false))
         .addRoleOption((o) => o.setName("role2").setDescription("Role").setRequired(false))
         .addRoleOption((o) => o.setName("role3").setDescription("Role").setRequired(false))
         .addRoleOption((o) => o.setName("role4").setDescription("Role").setRequired(false))
         .addRoleOption((o) => o.setName("role5").setDescription("Role").setRequired(false))
      )
      
      .addSubcommand((s) =>
        s.setName("restrict")
         .setDescription("Roles blocked when LinkGuard is ON.")
         .addRoleOption((o) => o.setName("role1").setDescription("Role").setRequired(false))
         .addRoleOption((o) => o.setName("role2").setDescription("Role").setRequired(false))
         .addRoleOption((o) => o.setName("role3").setDescription("Role").setRequired(false))
         .addRoleOption((o) => o.setName("role4").setDescription("Role").setRequired(false))
         .addRoleOption((o) => o.setName("role5").setDescription("Role").setRequired(false))
      )
      
      .addSubcommand((s) =>
        s.setName("block")
         .setDescription("Add a domain to the blacklist.")
         .addStringOption((o) =>
           o.setName("domain").setDescription("example.com").setRequired(true)
         )
      )
      
      .addSubcommand((s) =>
        s.setName("unblock")
         .setDescription("Remove a domain from the blacklist.")
         .addStringOption((o) =>
           o.setName("domain").setDescription("example.com").setRequired(true)
         )
      )
      
      .addSubcommand((s) =>
        s.setName("analyze")
         .setDescription("Analyze a URL for risk hints.")
         .addStringOption((o) =>
           o.setName("url").setDescription("https://...").setRequired(true)
         )
      ),

  ephemeral: true,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "activate") {
      const enabled = interaction.options.getBoolean("enabled", true);
      store.setServerEnabled(guildId, enabled);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("LINKGUARD")
            .setDescription(`Server-wide LinkGuard is now **${enabled ? "ON" : "OFF"}**.`)
            .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
        ]
      });
    }

    if (sub === "channel") {
      const ch = interaction.options.getChannel("channel", true);
      const enabled = interaction.options.getBoolean("enabled", true);

      store.setChannelEnabled(guildId, ch.id, enabled);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("LINKGUARD")
            .setDescription(`Channel override for <#${ch.id}> is now **${enabled ? "ON" : "OFF"}**.`)
            .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
        ]
      });
    }

    if (sub === "exempt" || sub === "restrict") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3"),
        interaction.options.getRole("role4"),
        interaction.options.getRole("role5")
      ].filter(Boolean);

      const ids = roles.map((r) => r.id);

      if (sub === "exempt") store.setExemptRoles(guildId, ids);
      else store.setRestrictRoles(guildId, ids);

      const title = sub === "exempt" ? "EXEMPT ROLES SET" : "RESTRICT ROLES SET";
      const desc =
        sub === "exempt"
          ? (ids.length ? `Exempt roles:\n${roles.map(r => `• <@&${r.id}>`).join("\n")}` : "Exempt roles cleared.")
          : (ids.length ? `Restricted roles:\n${roles.map(r => `• <@&${r.id}>`).join("\n")}` : "Restricted roles cleared. (LinkGuard will block everyone except exempt roles when ON.)");

      return interaction.editReply({
        embeds: [new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x3498db)]
      });
    }

    if (sub === "block") {
      const domain = normDomain(interaction.options.getString("domain", true));
      const ok = addDomainToBlacklist(domain);

      return interaction.editReply({
        content: ok ? `✅ Blacklisted: \`${domain}\`` : `⚠️ Already blacklisted: \`${domain}\``
      });
    }

    if (sub === "unblock") {
      const domain = normDomain(interaction.options.getString("domain", true));
      const ok = removeDomainFromBlacklist(domain);

      return interaction.editReply({
        content: ok ? `✅ Removed from blacklist: \`${domain}\`` : `⚠️ Not found in blacklist: \`${domain}\``
      });
    }

    if (sub === "analyze") {
      const url = interaction.options.getString("url", true).trim();
      const analysis = analyzeURL(url);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("URL ANALYSIS")
            .setDescription(`\`${url}\``)
            .addFields(
              { name: "Risk", value: analysis.riskLevel.toUpperCase(), inline: true },
              { name: "Domain", value: analysis.domain ? `\`${analysis.domain}\`` : "N/A", inline: true },
              { name: "Reasons", value: analysis.reasons.length ? analysis.reasons.map(r => `• ${r}`).join("\n") : "None", inline: false }
            )
            .setColor(
              analysis.riskLevel === "high" ? 0xe74c3c :
              analysis.riskLevel === "medium" ? 0xf1c40f :
              analysis.riskLevel === "unknown" ? 0x95a5a6 : 0x2ecc71
            )
        ]
      });
    }

    // status
    const st = store.getStatus(guildId);
    const bl = loadBlacklistedDomains();
    const wl = loadWhitelistedDomains();

    const chOverrides = Object.entries(st.channels || {})
      .map(([cid, v]) => `${v ? "✅" : "❌"} <#${cid}>`)
      .join("\n") || "None";

    const exempt = st.exemptRoles.length ? st.exemptRoles.map((id) => `<@&${id}>`).join(", ") : "None";
    const restrict = st.restrictRoles.length ? st.restrictRoles.map((id) => `<@&${id}>`).join(", ") : "None";

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("LINKGUARD STATUS")
          .setColor(0x5865f2)
          .addFields(
            { name: "Server-wide", value: st.enabled ? "✅ ON" : "❌ OFF", inline: true },
            { name: "Channel overrides", value: chOverrides, inline: false },
            { name: "Exempt roles", value: exempt, inline: false },
            { name: "Restricted roles", value: restrict, inline: false },
            { name: "Blacklist domains", value: `\`${bl.size}\``, inline: true },
            { name: "Whitelist domains", value: `\`${wl.size}\``, inline: true }
          )
      ]
    });
  }
};
