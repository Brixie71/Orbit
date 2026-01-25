const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// -------------------- ROLE IDS --------------------
// Replace placeholders with your real Role IDs.
const REQUEST_ROLE_ID_MAP = {
  raid: ["988186938194428076", "1032432925641289848"],
  rge_deployment: ["1032432925641289848", "1032774368419393586"],
  bunker_raid: ["1032774368419393586"],
  deployment: ["1032432925641289848", "1032774368419393586"],
  pvp_tournament: ["1032774368419393586"],
  bootcamp_ftc: ["988186938194428076", "1032432925641289848", "1032774368419393586"],
  btt: ["1032432925641289848", "1032774368419393586"],
  bravo_tryout: ["1463296354322354288", "1033428131639480380", "1033428216381190247"],
  trident_tryout: ["1126599333618405446"],
  apollo_tryout: ["1305643676512419850", "1110270262471041076", "1110270179159576676", "1350507856201388163"],
  minotaur_tryout: [
    "1409937035048915156",
    "1211710587638128682",
    "1211710617099042846"
  ],
  tau_tryout: ["1130164014652084365"]
};

const roleMention = (id) => `<@&${id}>`;
const formatType = (t) => t.replace(/_/g, " ").toUpperCase();
const DEFAULT_DETAILS = "No additional details provided.";
const WARN_PREFIX = "⚠️";
const NOTIFY_PREFIX = "📡 CHAIN NOTIFY";
const NO_CHAIN_MSG = "None (no configured chain roles)";

// -------------------- TIME HELPERS --------------------
function parseTimezoneOffsetToMinutes(tzRaw) {
  // Accepts: "GMT+8", "UTC+8", "GMT+08:00", "+08:00", "-0530", "UTC-5"
  if (!tzRaw) return null;

  const s = tzRaw.trim().toUpperCase();
  const m =
    s.match(/([+-])\s*(\d{1,2})(?::?(\d{2}))?$/) ||
    s.match(/(GMT|UTC)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/);

  if (!m) return null;

  const hasPrefix = m.length === 5;
  const sign = hasPrefix ? m[2] : m[1];
  const hh = hasPrefix ? m[3] : m[2];
  const mm = hasPrefix ? m[4] : m[3];

  const hours = Number(hh);
  const mins = mm ? Number(mm) : 0;

  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  if (hours > 14 || mins > 59) return null; // sane bounds

  const total = hours * 60 + mins;
  return sign === "-" ? -total : total;
}

function parseDateMMDDYYYY(dateStr) {
  const m = String(dateStr || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  return { year, month, day };
}

function parseTimeHHMM(timeStr) {
  const m = String(timeStr || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const hh = Number(m[1]);
  const mm = Number(m[2]);

  if (hh < 1 || hh > 12) return null; // 12-hour input (with AM/PM)
  if (mm < 0 || mm > 59) return null;

  return { hh, mm };
}

function to24h(hh12, ampm) {
  const ap = String(ampm || "").toUpperCase();
  if (ap !== "AM" && ap !== "PM") return null;

  let h = hh12 % 12;
  if (ap === "PM") h += 12;
  return h;
}

function getTodayDateInTimezone(offsetMinutes) {
  // Take "now in UTC", shift to "now in timezone", then read Y/M/D from that shifted time.
  const nowUtc = Date.now();
  const shifted = new Date(nowUtc + offsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function buildUnixTimestamp({ year, month, day, hour24, minute, offsetMinutes }) {
  // Input is local time in the provided timezone.
  // UTC = local - offset
  const utcMs = Date.UTC(year, month - 1, day, hour24, minute) - offsetMinutes * 60_000;
  return Math.floor(utcMs / 1000);
}

function discordStamp(unix) {
  return `<t:${unix}:F> • <t:${unix}:R>`;
}

// -------------------- COMMAND --------------------
module.exports = {
  data: new SlashCommandBuilder()
    .setName("eventrequest")
    .setDescription("Submit an operational event request (timezone-safe).")
    .addStringOption(opt =>
      opt
        .setName("request")
        .setDescription("Operation / Event type")
        .setRequired(true)
        .addChoices(
          { name: "Raid", value: "raid" },
          { name: "RGE Deployment", value: "rge_deployment" },
          { name: "Bunker Raid", value: "bunker_raid" },
          { name: "Deployment", value: "deployment" },
          { name: "PVP Tournament", value: "pvp_tournament" },
          { name: "Bootcamp + FTC", value: "bootcamp_ftc" },
          { name: "BTT", value: "btt" },
          { name: "Bravo Tryout", value: "bravo_tryout" },
          { name: "Trident Tryout", value: "trident_tryout" },
          { name: "Apollo Tryout", value: "apollo_tryout" },
          { name: "Minotaur Tryout", value: "minotaur_tryout" },
          { name: "TAU Tryout", value: "tau_tryout" }
        )
    )
    .addStringOption(opt =>
      opt
        .setName("execution")
        .setDescription("Execution window")
        .setRequired(true)
        .addChoices(
          { name: "NOW", value: "now" },
          { name: "TODAY", value: "today" },
          { name: "FUTURE", value: "future" }
        )
    )
    .addStringOption(opt =>
      opt
        .setName("timezone")
        .setDescription('Timezone offset (e.g. "GMT+8", "+08:00", "UTC-5")')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName("time")
        .setDescription('Time (HH:MM) e.g. "10:00"')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName("day")
        .setDescription("AM or PM")
        .setRequired(false)
        .addChoices({ name: "AM", value: "AM" }, { name: "PM", value: "PM" })
    )
    .addStringOption(opt =>
      opt
        .setName("date")
        .setDescription('Date (MM/DD/YYYY) e.g. "01/25/2026" (FUTURE only)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName("details")
        .setDescription("Situation / Intent / Notes")
        .setMaxLength(1500)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: `${WARN_PREFIX} Submit requests inside a server; DMs are not supported.`,
        ephemeral: true
      });
    }

    const requestType = interaction.options.getString("request", true);
    const execution = interaction.options.getString("execution", true);
    const tzRaw = interaction.options.getString("timezone");
    const timeRaw = interaction.options.getString("time");
    const day = interaction.options.getString("day");
    const dateRaw = interaction.options.getString("date");
    const details = (interaction.options.getString("details") || "").trim() || DEFAULT_DETAILS;

    // -------------------- TIME -> UNIX TIMESTAMP --------------------
    let unix;
    const tzLabel = tzRaw ? tzRaw.trim() : "Not provided";

    if (execution === "now") {
      unix = Math.floor(Date.now() / 1000);
    } else {
      // TODAY/FUTURE need timezone, time, day
      const offsetMinutes = parseTimezoneOffsetToMinutes(tzRaw);
      if (offsetMinutes === null) {
        return interaction.reply({
          content: `${WARN_PREFIX} Invalid timezone. Use formats like "GMT+8", "+08:00", "UTC-5".`,
          ephemeral: true
        });
      }

      const t = parseTimeHHMM(timeRaw);
      if (!t || !day) {
        return interaction.reply({
          content: `${WARN_PREFIX} Provide time + AM/PM. Example: time="10:00" day="PM".`,
          ephemeral: true
        });
      }

      const hour24 = to24h(t.hh, day);
      if (hour24 === null) {
        return interaction.reply({
          content: `${WARN_PREFIX} Day must be AM or PM.`,
          ephemeral: true
        });
      }

      let ymd;
      if (execution === "today") {
        ymd = getTodayDateInTimezone(offsetMinutes);
      } else {
        // FUTURE requires date
        const d = parseDateMMDDYYYY(dateRaw);
        if (!d) {
          return interaction.reply({
            content: `${WARN_PREFIX} FUTURE requires date in MM/DD/YYYY (e.g. "01/25/2026").`,
            ephemeral: true
          });
        }
        ymd = d;
      }

      unix = buildUnixTimestamp({
        year: ymd.year,
        month: ymd.month,
        day: ymd.day,
        hour24,
        minute: t.mm,
        offsetMinutes
      });
    }

    // -------------------- ROLE PINGS (IDs) --------------------
    const configuredRoleIds = REQUEST_ROLE_ID_MAP[requestType] || [];
    const availableRoleIds = configuredRoleIds.filter(id => interaction.guild.roles.cache.has(id));
    const missingRoleIds = configuredRoleIds.filter(id => !interaction.guild.roles.cache.has(id));
    const notifyLine = availableRoleIds.length ? availableRoleIds.map(roleMention).join(" ") : NO_CHAIN_MSG;

    // -------------------- EMBED (Professional / Tactical) --------------------
    const embed = new EmbedBuilder()
      .setColor(0x0b1220)
      .setTitle("OPS REQUEST // ACTION REQUIRED")
      .setDescription("Request submitted. Chain-of-command notified for review.")
      .addFields(
        { name: "REQUEST", value: formatType(requestType), inline: true },
        { name: "EXECUTION", value: execution.toUpperCase(), inline: true },
        { name: "TIME (AUTO-LOCAL)", value: discordStamp(unix), inline: false },
        { name: "REQUESTOR", value: `${interaction.user}`, inline: true },
        { name: "TZ INPUT", value: tzLabel, inline: true },
        { name: "CHAIN NOTIFY", value: notifyLine, inline: false },
        { name: "DETAILS / SITREP", value: details, inline: false }
      )
      .setFooter({ text: "AEGIS • Operational Request System" })
      .setTimestamp();

    // Pings must be in message content; allow only the mapped roles.
    await interaction.reply({
      content: `${NOTIFY_PREFIX}: ${notifyLine}`,
      embeds: [embed],
      allowedMentions: { roles: availableRoleIds, parse: [] }
    });

    if (missingRoleIds.length) {
      await interaction.followUp({
        content: `${WARN_PREFIX} Configured role IDs not found in this server: ${missingRoleIds.map(id => `${id}`).join(", ")}`,
        ephemeral: true
      });
    }
  }
};
