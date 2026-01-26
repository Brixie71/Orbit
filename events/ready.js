// events/ready.js
const { ActivityType, EmbedBuilder, Events } = require("discord.js");
const fs = require("fs");
const path = require("path");

const config = require("../config");
const { createStyledEmbed } = require("../utils/embedCreator");
// where we store last announced version
const DATA_DIR = path.join(__dirname, "..", "data");
const VERSION_FILE = path.join(DATA_DIR, "last-announced-version.json");

function readLastAnnouncedVersion() {
  try {
    if (!fs.existsSync(VERSION_FILE)) return null;
    const raw = fs.readFileSync(VERSION_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed?.version || null;
  } catch {
    return null;
  }
}

function writeLastAnnouncedVersion(version) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(VERSION_FILE, JSON.stringify({ version }, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write version file:", e.message);
  }
}

function buildNotesEmbed(client) {
  const v = config.bot?.version || "Unknown";
  const date = config.notes?.releaseDate || "Unknown date";
  const title = config.notes?.title || "ORBIT UPDATE NOTES";

  const embed = new EmbedBuilder()
    .setTitle(`◥◣ ${title} v${v} ◢◤`)
    .setColor(config.theme?.SECONDARY || "#1E90FF")
    .setDescription(`*Released on ${date}*\n\nLatest updates to the Orbit system:\n`)
    .setFooter({
      text: config.branding?.footerText || "🛰️ ORBIT OPERATIONS SYSTEM",
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp();

  const sections = Array.isArray(config.notes?.sections) ? config.notes.sections : [];
  if (sections.length) {
    embed.addFields(
      ...sections.map(s => ({
        name: s.name,
        value: s.value,
        inline: false
      }))
    );
  } else {
    embed.addFields({
      name: "📌 Notes",
      value: "No release notes configured in config.notes.sections yet.",
      inline: false
    });
  }

  return embed;
}

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    // Activity
    if (config.bot?.activity) {
      client.user.setActivity(config.bot.activity, { type: ActivityType.Watching });
    }

    // ---- STARTUP CHANNEL (STRICT) ----
    const STARTUP_CHANNEL_ID = process.env.STARTUP_CHANNEL_ID;

    if (!STARTUP_CHANNEL_ID) {
      console.error("STARTUP_CHANNEL_ID is not set in .env. Startup announcement skipped.");
      return;
    }

    // Ensure channel cache is warm (avoid “not found” early)
    try {
      const guildId = process.env.GUILD_ID;
      const guild = guildId ? client.guilds.cache.get(guildId) : null;
      if (guild) await guild.channels.fetch();
    } catch (e) {
      console.warn("Warning: could not fetch guild channels:", e.message);
    }

    let channel = null;
    try {
      channel = await client.channels.fetch(STARTUP_CHANNEL_ID);
    } catch (e) {
      console.error("Failed to fetch STARTUP channel. Check ID and permissions.", e.message);
      return;
    }

    if (!channel?.isTextBased?.()) {
      console.error("STARTUP_CHANNEL_ID does not point to a text channel.");
      return;
    }

    // ---- VERSION-GATED ANNOUNCEMENT ----
    const currentVersion = config.bot?.version || "Unknown";
    const lastVersion = readLastAnnouncedVersion();

    if (lastVersion === currentVersion) {
      console.log("No version change detected; startup update announcement skipped.");
      return;
    }

    try {
      const startupEmbed = createStyledEmbed(
        "ORBIT UPDATED!",
        "`SYSTEM ONLINE`\n\nOrbit systems have been updated and are now operational.",
        config.theme?.PRIMARY || "#0B1220"
      )
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: "🔄 STARTUP TIME", value: `\`${new Date().toLocaleString()}\``, inline: true },
          { name: "⚙️ VERSION", value: `\`${currentVersion}\``, inline: true },
          { name: "📊 STATUS", value: "`ALL SYSTEMS OPERATIONAL`", inline: true }
        );

      const notesEmbed = buildNotesEmbed(client);

      await channel.send({ embeds: [startupEmbed, notesEmbed] });

      console.log(`Startup update posted to channel ${channel.id} (v${currentVersion}).`);
      writeLastAnnouncedVersion(currentVersion);
    } catch (e) {
      console.error("Failed to send startup announcement:", e);
    }
  }
};
