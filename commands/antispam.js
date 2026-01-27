// commands/antispam.js
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
  } = require("discord.js");
  
  const { setAntiSpam } = require("../utils/guildSettings");
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("antispam")
      .setDescription("Configure anti-spam for this server")
      .addSubcommand((sc) =>
        sc
          .setName("toggle")
          .setDescription("Enable/disable anti-spam")
          .addBooleanOption((opt) =>
            opt.setName("active").setDescription("Enable anti-spam").setRequired(true)
          )
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
    ephemeral: true,
  
    async execute(interaction) {
      const active = interaction.options.getBoolean("active", true);
      setAntiSpam(interaction.guildId, active);
  
      return interaction.editReply({
        content: `🛡️ Anti-spam is now **${active ? "ENABLED" : "DISABLED"}** for this server.`,
        flags: MessageFlags.Ephemeral,
      });
    },
  };
  