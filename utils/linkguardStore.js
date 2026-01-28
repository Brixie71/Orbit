// utils/linkguardStore.js
const fs = require("fs");
const path = require("path");

const SETTINGS_PATH = path.join(__dirname, "../data/linkguard_settings.json");

function ensureFile() {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(SETTINGS_PATH)) {
    const initial = { guilds: {} };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readAll() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return { guilds: {} };
  }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), "utf8");
}

function getGuild(data, guildId) {
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      enabled: false,
      channels: {}, // channelId -> boolean
      exemptRoles: [], // roleIds
      restrictRoles: [] // roleIds
    };
  }
  return data.guilds[guildId];
}

function isServerEnabled(guildId) {
  const data = readAll();
  return !!getGuild(data, guildId).enabled;
}

function setServerEnabled(guildId, enabled) {
  const data = readAll();
  getGuild(data, guildId).enabled = !!enabled;
  writeAll(data);
}

function isChannelEnabled(guildId, channelId) {
  const data = readAll();
  const g = getGuild(data, guildId);
  if (typeof g.channels[channelId] === "boolean") return g.channels[channelId];
  return null; // no override
}

function setChannelEnabled(guildId, channelId, enabled) {
  const data = readAll();
  const g = getGuild(data, guildId);
  g.channels[channelId] = !!enabled;
  writeAll(data);
}

function getExemptRoles(guildId) {
  const data = readAll();
  return new Set(getGuild(data, guildId).exemptRoles || []);
}

function setExemptRoles(guildId, roleIds) {
  const data = readAll();
  const g = getGuild(data, guildId);
  g.exemptRoles = Array.from(new Set(roleIds));
  writeAll(data);
}

function getRestrictRoles(guildId) {
  const data = readAll();
  return new Set(getGuild(data, guildId).restrictRoles || []);
}

function setRestrictRoles(guildId, roleIds) {
  const data = readAll();
  const g = getGuild(data, guildId);
  g.restrictRoles = Array.from(new Set(roleIds));
  writeAll(data);
}

function getStatus(guildId) {
  const data = readAll();
  const g = getGuild(data, guildId);
  return {
    enabled: !!g.enabled,
    channels: g.channels || {},
    exemptRoles: g.exemptRoles || [],
    restrictRoles: g.restrictRoles || []
  };
}

module.exports = {
  SETTINGS_PATH,
  isServerEnabled,
  setServerEnabled,
  isChannelEnabled,
  setChannelEnabled,
  getExemptRoles,
  setExemptRoles,
  getRestrictRoles,
  setRestrictRoles,
  getStatus
};
