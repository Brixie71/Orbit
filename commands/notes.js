const { SlashCommandBuilder } = require("discord.js");
const { createStyledEmbed } = require("../utils/embedCreator");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("notes")
    .setDescription("View the latest Orbit update notes"),

  // Notes are informational → public by default
  noDefer: true,

  async execute(interaction) {
    const version = config.bot?.version ?? "?.?.?";
    const releaseDate = config.notes?.releaseDate ?? "Unknown date";
    const sections = Array.isArray(config.notes?.sections)
      ? config.notes.sections
      : [];

    const embed = createStyledEmbed(
      `📝 ORBIT UPDATE NOTES`,
      [
        `**Version \`${version}\`**`,
        `Released on **${releaseDate}**`,
        "",
        "—",
      ].join("\n"),
      config.theme.SECONDARY
    );

    // Meta row (acts like padding/header)
    embed.addFields(
      {
        name: "📦 Scope",
        value: "System & command updates",
        inline: true,
      },
      {
        name: "🛰️ Source",
        value: "Orbit Core",
        inline: true,
      }
    );

    embed.addFields({ name: "—", value: " ", inline: false });

    if (!sections.length) {
      embed.addFields({
        name: "📌 Notes",
        value: "No release notes configured.",
        inline: false,
      });
    } else {
      // Render sections with controlled spacing
      for (const section of sections) {
        embed.addFields({
          name: section.name,
          value: section.value,
          inline: false,
        });

        // Separator after each section to simulate margin
        embed.addFields({ name: "—", value: " ", inline: false });
      }
    }

    embed.setFooter({
      text: "🛰️ ORBIT OPERATIONS SYSTEM",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

    embed.setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
