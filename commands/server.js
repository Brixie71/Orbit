const { SlashCommandBuilder } = require("discord.js");
const { createStyledEmbed } = require("../utils/embedCreator");
const config = require("../config");

// Orbit server registry
const serverCodes = {
  MAX: {
    name: "Max's Server",
    code: "f58edae9-f816-4755-a34b-f6463f71dc8d",
  },
  SOCOM: {
    name: "Tingles's Server (SOCOM)",
    code: "ec2a20ce-805a-4d0c-b755-4d4d2884f80c",
  },
  TRAINING: {
    name: "Training Server (Bootcamp)",
    code: "1a32536a-63d3-4d43-8465-d16c9636a629",
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Display server codes")
    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription("List all available server codes")
    ),

  // 🔑 CRITICAL:
  // This command must NOT be deferred by interactionCreate.js
  // or it will be stuck ephemeral forever.
  noDefer: true,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "list") return;

    const embed = createStyledEmbed(
      "🛰️ SERVER CODES",
      "Below are all approved server codes for operations:",
      config.theme.SECONDARY
    );

    for (const key of Object.keys(serverCodes)) {
      const srv = serverCodes[key];
      embed.addFields({
        name: `✅ ${srv.name}`,
        value: `**SERVER CODE:**\n\`\`\`\n${srv.code}\n\`\`\``,
        inline: false,
      });
    }

    // ✅ PUBLIC RESPONSE (no ephemeral, no flags)
    // Since noDefer=true, this is safe.
    return interaction.reply({
      embeds: [embed],
    });
  },
};
