const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const { createStyledEmbed } = require("../utils/embedCreator");
const config = require("../config");

// -------------------- SERVER CODES --------------------
const SERVER_CODES = [
  { key: "max", name: "Max's Server", code: "f58edae9-f816-4755-a34b-f6463f71dc8d" },
  { key: "tingles", name: "Tingles's Server (SOCOM)", code: "ec2a20ce-805a-4d0c-b755-4d4d2884f80c" },
  { key: "training", name: "Training Server (Bootcamp)", code: "1a32536a-63d3-4d43-8465-d16c9636a629" }
];

// -------------------- ROLE IDS --------------------
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
  minotaur_tryout: ["1409937035048915156", "1211710587638128682", "1211710617099042846"],
  tau_tryout: ["1130164014652084365"]
};

const WARN = "⚠️";
const NOTIFY_PREFIX = "📡 CHAIN NOTIFY";
const roleMention = (id) => `<@&${id}>`;
const formatType = (t) => t.replace(/_/g, " ").toUpperCase();

// -------------------- TIME HELPERS --------------------
function parseTimezoneOffsetToMinutes(tzRaw) {
  if (!tzRaw) return null;
  const s = tzRaw.trim().toUpperCase();

  const m =
    s.match(/(GMT|UTC)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/) ||
    s.match(/^([+-])\s*(\d{1,2})(?::?(\d{2}))?$/);

  if (!m) return null;

  const hasPrefix = m[1] === "GMT" || m[1] === "UTC";
  const sign = hasPrefix ? m[2] : m[1];
  const hh = hasPrefix ? m[3] : m[2];
  const mm = hasPrefix ? m[4] : m[3];

  const hours = Number(hh);
  const mins = mm ? Number(mm) : 0;

  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  if (hours > 14 || mins > 59) return null;

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

  if (hh < 1 || hh > 12) return null;
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
  const shifted = new Date(Date.now() + offsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function buildUnixTimestamp({ year, month, day, hour24, minute, offsetMinutes }) {
  const utcMs = Date.UTC(year, month - 1, day, hour24, minute) - offsetMinutes * 60_000;
  return Math.floor(utcMs / 1000);
}

function stamp(unix) {
  return `<t:${unix}:F> • <t:${unix}:R>`;
}

function signatureOf({ requestType, unix, serverKey }) {
  return `${requestType}|${unix}|${serverKey}`;
}

// strict conditional requirements
function validateStrict({ execution, tzRaw, timeRaw, dayRaw, dateRaw }) {
  if (execution === "now") return { ok: true };

  if (!tzRaw) return { ok: false, msg: `${WARN} Timezone is required for TODAY/FUTURE.` };
  if (!timeRaw) return { ok: false, msg: `${WARN} Time is required for TODAY/FUTURE.` };
  if (!dayRaw) return { ok: false, msg: `${WARN} AM/PM is required for TODAY/FUTURE.` };

  if (execution === "future" && !dateRaw) {
    return { ok: false, msg: `${WARN} Date is required for FUTURE (MM/DD/YYYY).` };
  }

  return { ok: true };
}

// -------------------- COMMAND --------------------
module.exports = {
  data: new SlashCommandBuilder()
    .setName("eventrequest")
    .setDescription("Submit an operational event request (Orbit strict + confirm).")
    .addStringOption(opt =>
      opt.setName("request")
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
      opt.setName("execution")
        .setDescription("Execution window")
        .setRequired(true)
        .addChoices(
          { name: "NOW", value: "now" },
          { name: "TODAY", value: "today" },
          { name: "FUTURE", value: "future" }
        )
    )
    .addStringOption(opt =>
      opt.setName("server")
        .setDescription("Target server code")
        .setRequired(true)
        .addChoices(
          { name: "Max's Server", value: "max" },
          { name: "Tingles's Server (SOCOM)", value: "tingles" },
          { name: "Training Server (Bootcamp)", value: "training" }
        )
    )

    // Conditional (enforced in execute)
    .addStringOption(opt =>
      opt.setName("timezone")
        .setDescription('Timezone offset (e.g. "GMT+8", "+08:00", "UTC-5")')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("time")
        .setDescription('Time (HH:MM) e.g. "10:00"')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("day")
        .setDescription("AM or PM")
        .setRequired(false)
        .addChoices({ name: "AM", value: "AM" }, { name: "PM", value: "PM" })
    )
    .addStringOption(opt =>
      opt.setName("date")
        .setDescription('Date (MM/DD/YYYY) FUTURE only')
        .setRequired(false)
    )

    // Strict form required:
    .addStringOption(opt =>
      opt.setName("location")
        .setDescription("Muster location / venue")
        .setRequired(true)
        .setMaxLength(120)
    )
    .addStringOption(opt =>
      opt.setName("strength")
        .setDescription('Strength required (e.g. "8", "2 squads", "10+")')
        .setRequired(true)
        .setMaxLength(60)
    )
    .addStringOption(opt =>
      opt.setName("details")
        .setDescription("SITREP / intent / notes")
        .setRequired(true)
        .setMaxLength(1500)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: `${WARN} Submit requests inside a server; DMs are not supported.`,
        ephemeral: true
      });
    }

    const client = interaction.client;

    // Lazy init stores (so you don't have to touch index.js if you don't want)
    if (!client.pendingEventRequests) client.pendingEventRequests = new Map();
    if (!client.recentEventSignatures) client.recentEventSignatures = new Map();
    if (!client.channelCooldown) client.channelCooldown = new Map();
    if (!client.userSubmitCooldown) client.userSubmitCooldown = new Map();

    const requestType = interaction.options.getString("request", true);
    const execution = interaction.options.getString("execution", true);
    const serverKey = interaction.options.getString("server", true);

    const tzRaw = interaction.options.getString("timezone");
    const timeRaw = interaction.options.getString("time");
    const dayRaw = interaction.options.getString("day");
    const dateRaw = interaction.options.getString("date");

    const location = interaction.options.getString("location", true).trim();
    const strength = interaction.options.getString("strength", true).trim();
    const details = interaction.options.getString("details", true).trim();

    const opsCfg = config.ops || {};
    const userCooldownMs = opsCfg.userCooldownMs ?? 60_000;
    const channelCooldownMs = opsCfg.channelCooldownMs ?? 15_000;
    const duplicateWindowMs = opsCfg.duplicateWindowMs ?? (5 * 60_000);
    const previewExpiryMs = opsCfg.previewExpiryMs ?? (2 * 60_000);

    // Per-user: only one pending preview at a time
    for (const [, p] of client.pendingEventRequests) {
      if (p.userId === interaction.user.id && p.expiresAt > Date.now()) {
        return interaction.reply({
          content: `${WARN} You already have a pending request preview. Confirm or cancel it first.`,
          ephemeral: true
        });
      }
    }

    // Per-user submit cooldown
    const lastSubmit = client.userSubmitCooldown.get(interaction.user.id) || 0;
    if (Date.now() - lastSubmit < userCooldownMs) {
      const wait = Math.ceil((userCooldownMs - (Date.now() - lastSubmit)) / 1000);
      return interaction.reply({
        content: `⏳ Cooldown active. Try again in ${wait}s.`,
        ephemeral: true
      });
    }

    const strict = validateStrict({ execution, tzRaw, timeRaw, dayRaw, dateRaw });
    if (!strict.ok) return interaction.reply({ content: strict.msg, ephemeral: true });

    const server = SERVER_CODES.find(s => s.key === serverKey);
    if (!server) {
      return interaction.reply({ content: `${WARN} Unknown server selection.`, ephemeral: true });
    }

    // Build UNIX time
    let unix;
    const tzLabel = tzRaw ? tzRaw.trim() : "N/A";

    if (execution === "now") {
      unix = Math.floor(Date.now() / 1000);
    } else {
      const offsetMinutes = parseTimezoneOffsetToMinutes(tzRaw);
      if (offsetMinutes === null) {
        return interaction.reply({
          content: `${WARN} Invalid timezone. Use "GMT+8", "+08:00", "UTC-5".`,
          ephemeral: true
        });
      }

      const t = parseTimeHHMM(timeRaw);
      if (!t) {
        return interaction.reply({
          content: `${WARN} Invalid time. Use HH:MM (e.g. 10:00).`,
          ephemeral: true
        });
      }

      const hour24 = to24h(t.hh, dayRaw);
      if (hour24 === null) {
        return interaction.reply({ content: `${WARN} Day must be AM or PM.`, ephemeral: true });
      }

      let ymd;
      if (execution === "today") {
        ymd = getTodayDateInTimezone(offsetMinutes);
      } else {
        const d = parseDateMMDDYYYY(dateRaw);
        if (!d) {
          return interaction.reply({
            content: `${WARN} Invalid date. Use MM/DD/YYYY (e.g. 01/25/2026).`,
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

    // Duplicate detection (type + unix + serverKey)
    const sig = signatureOf({ requestType, unix, serverKey });
    const lastSig = client.recentEventSignatures.get(sig) || 0;
    if (Date.now() - lastSig < duplicateWindowMs) {
      return interaction.reply({
        content: `${WARN} Duplicate detected (same request + time + server within window). Denied.`,
        ephemeral: true
      });
    }

    // Role pings
    const configuredRoleIds = REQUEST_ROLE_ID_MAP[requestType] || [];
    const availableRoleIds = configuredRoleIds.filter(id => interaction.guild.roles.cache.has(id));
    const notifyLine = availableRoleIds.length ? availableRoleIds.map(roleMention).join(" ") : "None";

    // Embed (preview)
    const embed = createStyledEmbed(
      "OPS REQUEST // PREVIEW",
      "Review the details. Confirm to dispatch chain pings.",
      config.theme.PRIMARY
    ).addFields(
      { name: "REQUEST", value: formatType(requestType), inline: true },
      { name: "EXECUTION", value: execution.toUpperCase(), inline: true },
      { name: "TIME (AUTO-LOCAL)", value: stamp(unix), inline: false },

      { name: "SERVER", value: `**${server.name}**\n\`${server.code}\``, inline: false },

      { name: "LOCATION", value: location, inline: true },
      { name: "STRENGTH", value: strength, inline: true },

      { name: "REQUESTOR", value: `${interaction.user}`, inline: true },
      { name: "TZ INPUT", value: tzLabel, inline: true },

      { name: "CHAIN NOTIFY", value: notifyLine, inline: false },
      { name: "DETAILS / SITREP", value: details, inline: false }
    );

    // Confirm/Cancel buttons
    const token = `${interaction.user.id}.${Date.now()}`; // simple token; good enough for short-lived previews

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`evreq_confirm:${token}`)
        .setLabel("CONFIRM DISPATCH")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`evreq_cancel:${token}`)
        .setLabel("CANCEL")
        .setStyle(ButtonStyle.Secondary)
    );

    // Store pending payload for confirm step
    client.userSubmitCooldown.set(interaction.user.id, Date.now());

    client.pendingEventRequests.set(token, {
      userId: interaction.user.id,
      channelId: interaction.channelId,
      expiresAt: Date.now() + previewExpiryMs,

      signature: sig,
      duplicateWindowMs,
      channelCooldownMs,

      finalContent: `${NOTIFY_PREFIX}: ${notifyLine}`,
      finalEmbed: embed,
      allowedMentions: { roles: availableRoleIds, parse: [] }
    });

    return interaction.reply({
      content: "📝 **Preview generated.** Confirm to dispatch.",
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};
