const {
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
} = require("discord.js");

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  createAudioPlayer,
  NoSubscriberBehavior,
  createAudioResource,
  StreamType,
} = require("@discordjs/voice");

const { Readable } = require("stream");
const { TTSManager } = require("../utils/ttsManager");

function getTTS(client) {
  if (!client.tts) client.tts = new TTSManager();
  return client.tts;
}

// 20ms silence @ 48k stereo s16le => 3840 bytes
function silence() {
  return createAudioResource(
    Readable.from(Buffer.alloc(3840)),
    { inputType: StreamType.Raw }
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("orbit-tts")
    .setDescription("Orbit TTS controls")
    .addSubcommand((s) =>
      s.setName("join").setDescription("Join your voice channel")
    )
    .addSubcommand((s) =>
      s
        .setName("follow")
        .setDescription("Auto-read newest messages")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Text channel to read")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption((o) =>
          o.setName("active").setDescription("Enable/disable").setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName("leave").setDescription("Leave VC"))
    .addSubcommand((s) => s.setName("clear").setDescription("Clear TTS queue")),

  // Let your interactionCreate defer this normally
  ephemeral: true,

  async execute(interaction) {
    const tts = getTTS(interaction.client);
    const sub = interaction.options.getSubcommand();

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

      // Keep alive
      const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play },
      });

      connection.subscribe(player);
      player.play(silence());

      // Store connection for TTS manager queue playback
      tts.setConnection(interaction.guildId, connection);

      return interaction.editReply({
        content: `✅ Connected to ${vc}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "follow") {
      const channel = interaction.options.getChannel("channel", true);
      const active = interaction.options.getBoolean("active", true);

      if (active && !tts.isConnected(interaction.guildId)) {
        return interaction.editReply({
          content: "⚠️ Orbit must be in VC first. Use `/orbit-tts join`.",
          flags: MessageFlags.Ephemeral,
        });
      }

      tts.setFollowChannel(interaction.guildId, active ? channel.id : null);

      return interaction.editReply({
        content: active
          ? `📡 Follow mode enabled for ${channel}.`
          : "🛑 Follow mode disabled.",
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
      tts.disconnect(interaction.guildId);
      return interaction.editReply({
        content: "👋 Left VC and disabled follow mode.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
