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
const {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  STARTUP_CHANNEL_ID
} = process.env;

if (!TOKEN) throw new Error("Missing DISCORD_TOKEN");
if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
if (!GUILD_ID) throw new Error("Missing GUILD_ID");

// -------------------- CLIENT --------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

// -------------------- LOAD COMMANDS --------------------
const commands = [];
const commandsPath = path.join(__dirname, "commands");
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

  // Register slash commands (GUILD = instant)
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("Slash commands registered.");

  // Send startup message (optional)
  if (STARTUP_CHANNEL_ID) {
    try {
      const channel = await c.channels.fetch(STARTUP_CHANNEL_ID);
      if (channel?.isTextBased()) {
        await channel.send("🟢 **System online. Event requests channel is now active.**");
      }
    } catch (err) {
      console.error("Failed to send startup message:", err);
    }
  }
});

// -------------------- INTERACTIONS --------------------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "An error occurred while executing this command.",
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: "An error occurred while executing this command.",
        ephemeral: true
      });
    }
  }
});

// -------------------- LOGIN --------------------
client.login(TOKEN);
