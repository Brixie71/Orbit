require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  REST,
  Routes
} = require("discord.js");

// -------------------- ENV --------------------
const { TOKEN, CLIENT_ID, GUILD_ID, STARTUP_CHANNEL_ID } = process.env;

if (!TOKEN) throw new Error("Missing TOKEN");
if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
if (!GUILD_ID) throw new Error("Missing GUILD_ID");

// -------------------- CLIENT --------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

// Pending event requests (for confirm/cancel)
client.pendingEventRequests = new Map(); // token -> payload

// Recent signatures for duplicate detection
client.recentEventSignatures = new Map(); // signature -> lastSeenMs

// Channel cooldown for confirmed posts
client.channelCooldown = new Map(); // channelId -> lastConfirmedMs

// -------------------- RATE LIMIT (GLOBAL APP LEVEL) --------------------
// This is NOT Discord API rate limit; this is your bot abuse-throttle.
// Sliding window: N uses per window per (guild+user+command)
const RATE_LIMITS = {
  default: { windowMs: 10_000, max: 5 },
  eventrequest: { windowMs: 60_000, max: 3 },
  server: { windowMs: 10_000, max: 5 }
};

const rlStore = new Map(); // key -> { count, resetAt }

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rlStore) {
    if (v.resetAt <= now) rlStore.delete(k);
  }
}, 30_000).unref();

function checkRateLimit(interaction) {
  const cmd = interaction.commandName || "default";
  const cfg = RATE_LIMITS[cmd] || RATE_LIMITS.default;

  const key = `${interaction.guildId || "dm"}:${interaction.user.id}:${cmd}`;
  const now = Date.now();

  const entry = rlStore.get(key);
  if (!entry || entry.resetAt <= now) {
    rlStore.set(key, { count: 1, resetAt: now + cfg.windowMs });
    return { ok: true };
  }

  entry.count += 1;
  if (entry.count > cfg.max) {
    return { ok: false, retryAfterMs: entry.resetAt - now };
  }
  return { ok: true };
}

// -------------------- LOAD COMMANDS --------------------
const commands = [];
const commandsPath = path.join(__dirname, "commands");

if (!fs.existsSync(commandsPath)) {
  throw new Error(`Missing commands folder at: ${commandsPath}`);
}

const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }
}

// -------------------- READY --------------------
client.once(Events.ClientReady, async (c) => {
  console.log(`Bot logged in as ${c.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Slash commands registered.");
  } catch (e) {
    console.error("Failed to register slash commands:", e);
  }

  if (STARTUP_CHANNEL_ID) {
    try {
      const channel = await c.channels.fetch(STARTUP_CHANNEL_ID);
      if (channel?.isTextBased()) {
        await channel.send("🟢 **System online.**");
      }
    } catch (err) {
      console.error("Failed to send startup message:", err);
    }
  }
});

// -------------------- INTERACTIONS --------------------
client.on(Events.InteractionCreate, async (interaction) => {
  // ---------- SLASH ----------
  if (interaction.isChatInputCommand()) {
    const rl = checkRateLimit(interaction);
    if (!rl.ok) {
      const secs = Math.ceil(rl.retryAfterMs / 1000);
      return interaction.reply({
        content: `⏳ Too many requests. Try again in ${secs}s.`,
        ephemeral: true
      });
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      const msg = "An error occurred while executing this command.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
    return;
  }

  // ---------- BUTTONS (CONFIRM/CANCEL) ----------
  if (interaction.isButton()) {
    const id = interaction.customId || "";

    // Expected customIds:
    // evreq_confirm:<token>
    // evreq_cancel:<token>
    if (!id.startsWith("evreq_confirm:") && !id.startsWith("evreq_cancel:")) return;

    const [action, token] = id.split(":");
    const payload = client.pendingEventRequests.get(token);

    if (!payload) {
      return interaction.reply({
        content: "⚠️ This request preview expired or was already processed.",
        ephemeral: true
      });
    }

    // Only the original requester can confirm/cancel
    if (payload.userId !== interaction.user.id) {
      return interaction.reply({
        content: "⛔ You can't confirm/cancel someone else’s request.",
        ephemeral: true
      });
    }

    // Expiry check
    if (payload.expiresAt <= Date.now()) {
      client.pendingEventRequests.delete(token);
      return interaction.reply({
        content: "⚠️ This request preview expired. Submit again.",
        ephemeral: true
      });
    }

    // Cancel
    if (action === "evreq_cancel") {
      client.pendingEventRequests.delete(token);
      return interaction.update({
        content: "❎ Request cancelled.",
        components: [],
        embeds: []
      });
    }

    // Confirm: channel cooldown (anti-flood)
    const lastConfirmed = client.channelCooldown.get(payload.channelId) || 0;
    const channelCooldownMs = payload.channelCooldownMs;
    if (Date.now() - lastConfirmed < channelCooldownMs) {
      const wait = Math.ceil((channelCooldownMs - (Date.now() - lastConfirmed)) / 1000);
      return interaction.reply({
        content: `⏳ Channel cooldown active. Try again in ${wait}s.`,
        ephemeral: true
      });
    }

    // Duplicate detection at confirm time as well
    const sig = payload.signature;
    const lastSig = client.recentEventSignatures.get(sig) || 0;
    if (Date.now() - lastSig < payload.duplicateWindowMs) {
      return interaction.reply({
        content: "⚠️ Duplicate detected (same request + same time + same server). Denied.",
        ephemeral: true
      });
    }

    // Mark signature + cooldown
    client.recentEventSignatures.set(sig, Date.now());
    client.channelCooldown.set(payload.channelId, Date.now());

    // Post final message
    try {
      const channel = await client.channels.fetch(payload.channelId);
      if (!channel?.isTextBased()) throw new Error("Channel not text-based");

      await channel.send({
        content: payload.finalContent,
        embeds: [payload.finalEmbed],
        allowedMentions: payload.allowedMentions
      });

      // Remove pending and update the preview message
      client.pendingEventRequests.delete(token);
      await interaction.update({
        content: "✅ Request confirmed and dispatched.",
        components: [],
        embeds: [payload.finalEmbed] // keep the embed visible in the preview for records
      });
    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: "⚠️ Failed to dispatch the request. Check bot permissions.",
        ephemeral: true
      });
    }
  }
});

// -------------------- CLEANUP (PREVENT MAP GROWTH) --------------------
setInterval(() => {
  const now = Date.now();

  // pending previews
  for (const [token, p] of client.pendingEventRequests) {
    if (p.expiresAt <= now) client.pendingEventRequests.delete(token);
  }

  // recent signatures
  for (const [sig, ts] of client.recentEventSignatures) {
    if (now - ts > 10 * 60_000) client.recentEventSignatures.delete(sig); // keep ~10 minutes
  }
}, 30_000).unref();

// -------------------- PROCESS SAFETY --------------------
process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));

client.login(TOKEN);
