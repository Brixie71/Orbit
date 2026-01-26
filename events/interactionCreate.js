const { Events } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // ---------------- SLASH ----------------
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        // Per-command ephemeral control:
        // - command.ephemeral = true  => only requester sees it
        // - command.ephemeral = false => public in channel
        // Default: PUBLIC
        const ephemeral =
          typeof command.ephemeral === "boolean" ? command.ephemeral : false;

        // Acknowledge quickly to avoid "Unknown interaction" on slow commands.
        // Only defer if the command hasn't already replied (it shouldn't have yet).
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral });
        }

        // IMPORTANT: Inside commands, prefer interaction.editReply()/followUp()
        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        const msg = "There was an error while executing this command.";

        try {
          if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ content: msg });
          } else if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: msg, ephemeral: true });
          } else {
            await interaction.reply({ content: msg, ephemeral: true });
          }
        } catch (e) {
          console.error("Failed to respond to interaction error:", e);
        }
      }
      return;
    }

    // ---------------- BUTTONS (CONFIRM/CANCEL) ----------------
    if (!interaction.isButton()) return;

    const id = interaction.customId || "";
    if (!id.startsWith("evreq_confirm:") && !id.startsWith("evreq_cancel:")) return;

    const [, token] = id.split(":");
    const client = interaction.client;

    if (!client.pendingEventRequests) client.pendingEventRequests = new Map();
    if (!client.recentEventSignatures) client.recentEventSignatures = new Map();
    if (!client.channelCooldown) client.channelCooldown = new Map();

    const payload = client.pendingEventRequests.get(token);
    if (!payload) return interaction.deferUpdate();

    // Only requester can confirm/cancel
    if (payload.userId !== interaction.user.id) {
      return interaction.reply({
        content: "⛔ You can’t confirm/cancel someone else’s request.",
        ephemeral: true,
      });
    }

    // Expired
    if (payload.expiresAt <= Date.now()) {
      client.pendingEventRequests.delete(token);
      return interaction.reply({
        content: "⚠️ This request preview expired. Submit again.",
        ephemeral: true,
      });
    }

    // Cancel
    if (id.startsWith("evreq_cancel:")) {
      client.pendingEventRequests.delete(token);
      return interaction.update({
        content: "❎ Request cancelled.",
        components: [],
        embeds: [],
      });
    }

    // Confirm: channel cooldown
    const lastConfirmed = client.channelCooldown.get(payload.channelId) || 0;
    if (Date.now() - lastConfirmed < payload.channelCooldownMs) {
      const wait = Math.ceil(
        (payload.channelCooldownMs - (Date.now() - lastConfirmed)) / 1000
      );
      return interaction.reply({
        content: `⏳ Channel cooldown active. Try again in ${wait}s.`,
        ephemeral: true,
      });
    }

    // Confirm: duplicate detection
    const lastSig = client.recentEventSignatures.get(payload.signature) || 0;
    if (Date.now() - lastSig < payload.duplicateWindowMs) {
      return interaction.reply({
        content: "⚠️ Duplicate detected (same request + time + server). Denied.",
        ephemeral: true,
      });
    }

    // Mark
    client.channelCooldown.set(payload.channelId, Date.now());
    client.recentEventSignatures.set(payload.signature, Date.now());

    // Dispatch message to channel
    try {
      await interaction.channel.send({
        content: payload.finalContent,
        embeds: [payload.finalEmbed],
        allowedMentions: payload.allowedMentions,
      });

      client.pendingEventRequests.delete(token);

      return interaction.update({
        content: "✅ Request confirmed and dispatched.",
        components: [],
        embeds: [payload.finalEmbed],
      });
    } catch (err) {
      console.error(err);
      // If the button interaction was already updated/replied somehow, avoid double-ack
      if (interaction.deferred || interaction.replied) return;
      return interaction.reply({
        content: "⚠️ Failed to dispatch. Check bot permissions in this channel.",
        ephemeral: true,
      });
    }
  },
};
