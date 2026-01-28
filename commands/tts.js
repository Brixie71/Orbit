// commands/tts.js
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    ChannelType,
  } = require("discord.js");
  
  const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
  } = require("@discordjs/voice");
  
  const { TTSManager } = require("../utils/ttsManager.js");
  
  function getTTS(client) {
    if (!client.tts) client.tts = new TTSManager();
    return client.tts;
  }
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("orbit-tts")
      .setDescription("Orbit TTS controls")
      .addSubcommand((s) => s.setName("join").setDescription("Join your voice channel"))
      .addSubcommand((s) =>
        s
          .setName("follow")
          .setDescription("Auto-read the newest messages from a text channel")
          .addChannelOption((o) =>
            o
              .setName("channel")
              .setDescription("Text channel to read")
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildText)
          )
          .addBooleanOption((o) =>
            o.setName("active").setDescription("Enable/disable follow mode").setRequired(true)
          )
      )
      .addSubcommand((s) => s.setName("leave").setDescription("Leave VC"))
      .addSubcommand((s) => s.setName("clear").setDescription("Clear the TTS queue")),
      //.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
    ephemeral: true,
  
    async execute(interaction) {
      const sub = interaction.options.getSubcommand();
      const tts = getTTS(interaction.client);
  
      if (sub === "join") {
        const vc = interaction.member?.voice?.channel;
        if (!vc) {
          return interaction.editReply({
            content: "⚠️ You must be in a voice channel.",
            flags: MessageFlags.Ephemeral,
          });
        }
  
        const connection = joinVoiceChannel({
          channelId: vc.id,
          guildId: vc.guild.id,
          adapterCreator: vc.guild.voiceAdapterCreator,
          selfDeaf: false,
        });
  
        try {
          await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
        } catch {
          connection.destroy();
          return interaction.editReply({
            content: "⛔ Failed to connect to VC.",
            flags: MessageFlags.Ephemeral,
          });
        }
  
        tts.setConnection(interaction.guildId, connection);
  
        return interaction.editReply({
          content: `✅ Connected to ${vc}.`,
          flags: MessageFlags.Ephemeral,
        });
      }
  
      if (sub === "follow") {
        const ch = interaction.options.getChannel("channel", true);
        const active = interaction.options.getBoolean("active", true);
  
        if (active && !tts.isConnected(interaction.guildId)) {
          return interaction.editReply({
            content: "⚠️ Orbit must be in a VC first. Use `/orbit-tts join`.",
            flags: MessageFlags.Ephemeral,
          });
        }
  
        tts.setFollowChannel(interaction.guildId, active ? ch.id : null);
  
        return interaction.editReply({
          content: active
            ? `📡 Follow mode **ENABLED**. Reading newest messages from ${ch}.`
            : "🛑 Follow mode **DISABLED**.",
          flags: MessageFlags.Ephemeral,
        });
      }
  
      if (sub === "clear") {
        tts.clearQueue(interaction.guildId);
        return interaction.editReply({
          content: "🧹 TTS queue cleared.",
          flags: MessageFlags.Ephemeral,
        });
      }
  
      if (sub === "leave") {
        // destroy connection if present
        const state = interaction.client.tts?.guild?.get(interaction.guildId);
        state?.connection?.destroy();
        if (state) state.connection = null;
  
        tts.setFollowChannel(interaction.guildId, null);
        tts.clearQueue(interaction.guildId);
  
        return interaction.editReply({
          content: "👋 Left VC and disabled follow mode.",
          flags: MessageFlags.Ephemeral,
        });
      }
    },
  };
  