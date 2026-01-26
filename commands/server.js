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
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List all available server codes")
    ),

  // optional: lets your interactionCreate handler decide (if you use that pattern)
  // ephemeral: false,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== "list") return;

    const serverEmbed = createStyledEmbed(
      "🛰️ SERVER CODES",
      "Below are all approved server codes for operations:",
      config.theme.SECONDARY
    );

    for (const key in serverCodes) {
      const server = serverCodes[key];
      serverEmbed.addFields({
        name: `✅ ${server.name}`,
        value: `**SERVER CODE:**\n\`\`\`\n${server.code}\n\`\`\``,
        inline: false,
      });
    }

    const payload = { embeds: [serverEmbed], ephemeral: false }; // 👈 public

    // If your global handler already deferred, you must editReply instead of reply.
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply(payload);
    }
  },
};
