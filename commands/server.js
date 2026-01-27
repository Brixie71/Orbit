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
      subcommand.setName("list").setDescription("List all BRM5 server codes")
    ),

  // This command must NOT be deferred by interactionCreate.js
  noDefer: true,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "list") return;

    const embed = createStyledEmbed(
      "🛰️ UNIED DIVISIONS OF DEFENSE SERVER CODES",
      [
        "**Approved server registry**",
        "Use these codes for system linking and operational routing.",
        "",
        "—",
      ].join("\n"),
      config.theme.SECONDARY
    );

    // Optional: add a compact “header row” as fields (looks like padding)
    embed.addFields(
      {
        name: "📌 Format",
        value: "`SERVER NAME` → code block",
        inline: true,
      },
      {
        name: "🔐 Handling",
        value: "Do not share publicly.",
        inline: true,
      }
    );

    embed.addFields({ name: "—", value: " ", inline: false });

    const entries = Object.values(serverCodes);

    // Use inline fields (2 columns) for better spacing on desktop
    // and keep code blocks short and clean.
    for (let i = 0; i < entries.length; i += 2) {
      const left = entries[i];
      const right = entries[i + 1];

      embed.addFields(
        {
          name: `✅ ${left.name}`,
          value: `\`\`\`\n${left.code}\n\`\`\``,
          inline: true,
        },
        right
          ? {
              name: `✅ ${right.name}`,
              value: `\`\`\`\n${right.code}\n\`\`\``,
              inline: true,
            }
          : {
              name: "\u200B",
              value: "\u200B",
              inline: true,
            }
      );

      // Add a thin separator after each row to simulate padding/margins
      if (i + 2 < entries.length) {
        embed.addFields({ name: "—", value: " ", inline: false });
      }
    }

    embed.setFooter({
      text: "🛰️ ORBIT • Server Registry",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

    return interaction.reply({ embeds: [embed] });
  },
};
