const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("notes")
    .setDescription("View the latest Orbit update notes"),

  // Set to true if you want notes private; false = public
  ephemeral: false,

  async execute(interaction) {
    const v = config.bot?.version ?? "?.?.?";
    const date = config.notes?.releaseDate || "Unknown date";
    const title = config.notes?.title || "ORBIT UPDATE NOTES";

    const embed = new EmbedBuilder()
      .setTitle(`◥◣ ${title} v${v} ◢◤`)
      .setColor(config.theme.SECONDARY)
      .setDescription(`*Released on ${date}*\n\nLatest updates to the Orbit system:\n`)
      .setFooter({
        text: config.branding?.footerText || "🛰️ ORBIT OPERATIONS SYSTEM",
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setTimestamp();

    const sections = Array.isArray(config.notes?.sections) ? config.notes.sections : [];
    if (sections.length) {
      embed.addFields(
        ...sections.map((s) => ({
          name: s.name,
          value: s.value,
          inline: false,
        }))
      );
    } else {
      embed.addFields({
        name: "📌 Notes",
        value: "No release notes configured in config.notes.sections yet.",
        inline: false,
      });
    }

    // Handler deferred already → editReply, not reply
    return interaction.editReply({ embeds: [embed] });
  },
};
