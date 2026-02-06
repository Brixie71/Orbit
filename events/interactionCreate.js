const { Events, MessageFlags } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // ---------------- RATE LIMIT (GLOBAL) ----------------
    const rlFn = interaction.client.checkRateLimit;
    if (typeof rlFn === "function") {
      const rl = rlFn(interaction);
      if (rl && rl.ok === false) {
        const seconds = Math.max(1, Math.ceil((rl.retryAfterMs || 0) / 1000));
        const content = `⛔ Rate limit hit. Try again in **${seconds}s**.`;

        // Must respond safely depending on interaction state
        if (!interaction.deferred && !interaction.replied) {
          return interaction.reply({ content, flags: MessageFlags.Ephemeral });
        }
        if (interaction.deferred && !interaction.replied) {
          return interaction.editReply({ content });
        }
        return interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      }
    }

    // ---------------- AUTOCOMPLETE ----------------
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command || typeof command.autocomplete !== "function") return;

      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error("Autocomplete error:", err);
      }
      return;
    }

    // ---------------- SLASH ----------------
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        // Per-command ephemeral control (default PUBLIC)
        const isEphemeral =
          typeof command.ephemeral === "boolean" ? command.ephemeral : false;

        const shouldDefer =
          !command.noDefer && !interaction.deferred && !interaction.replied;

        if (shouldDefer) {
          await interaction.deferReply({
            flags: isEphemeral ? MessageFlags.Ephemeral : undefined,
          });
        }

        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        const msg = "There was an error while executing this command.";

        try {
          if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ content: msg });
          } else if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
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

    if (payload.userId !== interaction.user.id) {
      return interaction.reply({
        content: "⛔ You can’t confirm/cancel someone else’s request.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (payload.expiresAt <= Date.now()) {
      client.pendingEventRequests.delete(token);
      return interaction.reply({
        content: "⚠️ This request preview expired. Submit again.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (id.startsWith("evreq_cancel:")) {
      client.pendingEventRequests.delete(token);
      return interaction.update({
        content: "❎ Request cancelled.",
        components: [],
        embeds: [],
      });
    }

    const lastConfirmed = client.channelCooldown.get(payload.channelId) || 0;
    if (Date.now() - lastConfirmed < payload.channelCooldownMs) {
      const wait = Math.ceil(
        (payload.channelCooldownMs - (Date.now() - lastConfirmed)) / 1000
      );
      return interaction.reply({
        content: `⏳ Channel cooldown active. Try again in ${wait}s.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const lastSig = client.recentEventSignatures.get(payload.signature) || 0;
    if (Date.now() - lastSig < payload.duplicateWindowMs) {
      return interaction.reply({
        content: "⚠️ Duplicate detected (same request + time + server). Denied.",
        flags: MessageFlags.Ephemeral,
      });
    }

    client.channelCooldown.set(payload.channelId, Date.now());
    client.recentEventSignatures.set(payload.signature, Date.now());

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
      if (interaction.deferred || interaction.replied) return;
      return interaction.reply({
        content: "⚠️ Failed to dispatch. Check bot permissions in this channel.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
