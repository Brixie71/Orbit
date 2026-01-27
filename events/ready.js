const { ActivityType } = require("discord.js");
const config = require("../config");
const { createStyledEmbed } = require("../utils/embedCreator");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    client.user.setActivity(config.bot.activity, { type: ActivityType.Watching });

    const channelId = process.env.STARTUP_CHANNEL_ID;
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const embed = createStyledEmbed(
      "ORBIT SYSTEM OPERATIONAL!",
      "`SYSTEM ONLINE`\n\nOrbit systems have been updated and are now operational.",
      config.theme.PRIMARY
    );

    embed
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
      );

    // ───────────── PATCH NOTES (COMPACT) ─────────────
    if (config.notes?.sections?.length) {
      embed.addFields({
        name: `📝 WHAT'S NEW (v${config.bot.version})`,
        value: config.notes.sections
          .map(
            (s) =>
              `**${s.name.replace(/^[^a-zA-Z]+/, "")}**\n${s.value
                .split("\n")
                .slice(0, 3)
                .join("\n")}`
          )
          .join("\n\n"),
      });
    }

    embed
      .setFooter({
        text: "🛰️ ORBIT OPERATIONS SYSTEM",
        iconURL: client.user.displayAvatarURL(),
      })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  },
};
