require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  REST,
  Routes
} = require("discord.js");

// -------------------- ENV --------------------
const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

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

// Make embedCreator icon resolving work (if you use global.client there)
global.client = client;

// -------------------- RATE LIMIT (GLOBAL APP LEVEL) --------------------
const RATE_LIMITS = {
  default: { windowMs: 10_000, max: 5 },
  eventrequest: { windowMs: 60_000, max: 3 },
  server: { windowMs: 10_000, max: 5 },
  notes: { windowMs: 10_000, max: 5 }
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

// -------------------- LOAD EVENTS --------------------
const eventsPath = path.join(__dirname, "events");

if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"));

  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));

    if (!event?.name || typeof event.execute !== "function") continue;

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

// -------------------- READY (REGISTER ONLY) --------------------
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
    if (now - ts > 10 * 60_000) client.recentEventSignatures.delete(sig);
  }
}, 30_000).unref();

// -------------------- PROCESS SAFETY --------------------
process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));

client.login(TOKEN);
