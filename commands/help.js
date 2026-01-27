const { SlashCommandBuilder } = require("discord.js");
const { createStyledEmbed } = require("../utils/embedCreator");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show available Orbit commands"),

  noDefer: true,

  async execute(interaction) {
    const embed = createStyledEmbed(
      "ORBIT COMMAND CENTER",
      "Orbit operational manual online.",
      config.theme.PRIMARY
    );

    embed.setThumbnail(interaction.client.user.displayAvatarURL());

    // Build a clean list of commands
    const cmds = [...interaction.client.commands.values()]
      .map((c) => ({
        name: `\`/${c.data?.name ?? "unknown"}\``,
        value: c.data?.description ?? "No description",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Chunk fields so we don’t exceed embed limits
    for (const c of cmds.slice(0, 25)) {
      embed.addFields({ name: c.name, value: c.value, inline: false });
    }

    embed
      .setFooter({
        text: "🛰️ ORBIT OPERATIONS SYSTEM",
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
