const { SlashCommandBuilder} = require("discord.js");
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
      subcommand.setName("list").setDescription("List all BRM5 server codes")
    ),

  // This command must NOT be deferred by interactionCreate.js
  noDefer: true,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "list") return;

    const embed = createStyledEmbed(
      "🛰️ UNITED DIVISIONS OF DEFENSE BRM 5 SERVER CODES",
      [
        "**Approved server registry**",
        "Use these codes to join the UDOD Official BRM5 Servers",
      ].join("\n"),
      config.theme.SECONDARY
    );

    const entries = Object.values(serverCodes);

    // Two-column layout
    for (let i = 0; i < entries.length; i += 2) {
      const left = entries[i];
      const right = entries[i + 1];

      embed.addFields(
        {
          name: `🛰️ ${left.name}`,
          value: `\`\`\`\n${left.code}\n\`\`\``,
          inline: true,
        },
        right
          ? {
              name: `🛰️ ${right.name}`,
              value: `\`\`\`\n${right.code}\n\`\`\``,
              inline: true,
            }
          : {
              name: "\u200B",
              value: "\u200B",
              inline: true,
            }
      );

      if (i + 2 < entries.length) {
        embed.addFields({ name: "—", value: " ", inline: false });
      }
    }

    embed.setFooter({
      text: "ORBIT • Blackhawk Rescue Mission 5 Server Registry",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

    // ✅ Reply with embed + optional attached banner file
    return interaction.reply({
      embeds: [embed],
    });
  },
};
