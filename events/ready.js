const { ActivityType, AttachmentBuilder } = require("discord.js");
const path = require("path");

const config = require("../config");
const { createStyledEmbed } = require("../utils/embedCreator");

function safeAttach(filePath, name) {
  try {
    const abs = path.join(process.cwd(), filePath);
    return new AttachmentBuilder(abs, { name });
  } catch {
    return null;
  }
}

function buildCompactNotesText(sections, maxLinesPerSection = 3) {
  return sections
    .map((s) => {
      const cleanName = s.name.replace(/^[^a-zA-Z]+/, "").trim(); // remove leading emoji/symbols for tight UI
      const lines = String(s.value || "")
        .split("\n")
        .filter(Boolean)
        .slice(0, maxLinesPerSection)
        .join("\n");
      return `**${cleanName}**\n${lines}`;
    })
    .join("\n\n");
}

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    client.user.setActivity(config.bot.activity, { type: ActivityType.Watching });

    const channelId = process.env.STARTUP_CHANNEL_ID;
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    // ============= 1) STARTUP EMBED (single chat) =============
    const startupEmbed = createStyledEmbed(
      "✧ ORBIT UPDATED! ✧",
      "`SYSTEM ONLINE`\n\nOrbit systems have been updated and are now operational.",
      config.theme.PRIMARY
    );

    startupEmbed
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: "🔄 STARTUP TIME",
          value: `\`${new Date().toLocaleString()}\``,
          inline: true,
        },
        {
          name: "⚙️ VERSION",
          value: `\`${config.bot.version}\``,
          inline: true,
        },
        {
          name: "📊 STATUS",
          value: "`ALL SYSTEMS OPERATIONAL`",
          inline: true,
        }
      )
      .setFooter({
        text: config.branding.footerText,
        iconURL: client.user.displayAvatarURL(),
      })
      .setTimestamp();

    // Optional startup banner (local file)
    const startupBanner = safeAttach(config.assets?.startupBannerPath, "startup-banner.png");
    if (startupBanner) {
      startupEmbed.setImage("attachment://startup-banner.png");
      await channel.send({ embeds: [startupEmbed], files: [startupBanner] });
    } else {
      await channel.send({ embeds: [startupEmbed] });
    }

    // ============= 2) NOTES EMBED (separate chat) =============
    const sections = Array.isArray(config.notes?.sections) ? config.notes.sections : [];
    const releaseDate = config.notes?.releaseDate ?? "Unknown date";

    const notesEmbed = createStyledEmbed(
      `📝 ORBIT UPDATE NOTES v${config.bot.version}`,
      [`Released on **${releaseDate}**`, "", "—"].join("\n"),
      config.theme.SECONDARY
    );

    notesEmbed
      .addFields(
        {
          name: "📦 Summary",
          value: sections.length
            ? buildCompactNotesText(sections, 3)
            : "No release notes configured.",
          inline: false,
        }
      )
      .setFooter({
        text: config.branding.footerText,
        iconURL: client.user.displayAvatarURL(),
      })
      .setTimestamp();

    // Optional notes banner (local file)
    const notesBanner = safeAttach(config.assets?.notesBannerPath, "notes-banner.png");
    if (notesBanner) {
      notesEmbed.setImage("attachment://notes-banner.png");
      await channel.send({ embeds: [notesEmbed], files: [notesBanner] });
    } else {
      await channel.send({ embeds: [notesEmbed] });
    }
  },
  inactivity: {
    enabled: true,
    thresholdDays: 30,
    scanEveryMinutes: 60,
    roleName: "INACTIVE",
    nicknamePrefix: "INACTIVE | "
  },
};
