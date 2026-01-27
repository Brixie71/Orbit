const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { createStyledEmbed } = require("../utils/embedCreator");
const config = require("../config");
const path = require("path");

function safeAttach(filePath, name) {
  try {
    const abs = path.join(process.cwd(), filePath);
    return new AttachmentBuilder(abs, { name });
  } catch {
    return null;
  }
}

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
      "🛰️ UNITED DIVISIONS OF DEFENSE SERVER CODES",
      [
        "**Approved server registry**",
        "Use these codes for system linking and operational routing.",
        "",
        "—",
      ].join("\n"),
      config.theme.SECONDARY
    );

    // ✅ Add local banner (if available)
    // Make sure config.assets.serverBannerPath points to something like: "assets/server.png"
    const serverBanner = safeAttach(
      config.assets?.serverBannerPath,
      "server.png"
    );
    if (serverBanner) {
      embed.setImage("attachment://server.png");
    }

    // Header row
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

    // Two-column layout
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

      if (i + 2 < entries.length) {
        embed.addFields({ name: "—", value: " ", inline: false });
      }
    }

    embed.setFooter({
      text: "🛰️ ORBIT • Server Registry",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

    // ✅ Reply with embed + optional attached banner file
    return interaction.reply({
      embeds: [embed],
      files: serverBanner ? [serverBanner] : [],
    });
  },
};
