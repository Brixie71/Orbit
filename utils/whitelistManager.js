// utils/whitelistManager.js
const fs = require("fs");
const path = require("path");

const WHITELIST_FILE_PATH = path.join(__dirname, "../data/whitelist_domains.txt");

let cachedSet = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000;

function normalizeDomain(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0];
}

function ensureWhitelistFile() {
  const dir = path.dirname(WHITELIST_FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(WHITELIST_FILE_PATH)) {
    const defaults = [
      "# Whitelisted domains - one per line",
      "youtube.com",
      "youtu.be",
      "twitch.tv",
      "discord.gg",
      "discord.com",
      "cdn.discordapp.com",
      "media.discordapp.net",
      "tenor.com",
      "imgur.com",
      "gyazo.com",
      "soundcloud.com",
      "spotify.com",
      "# Google Docs/Drive",
      "docs.google.com",
      "drive.google.com",
      "forms.gle",
      "sites.google.com",
      "googleusercontent.com",
      "# Medal.tv",
      "medal.tv",
      "medal.gg"
    ].join("\n");
    fs.writeFileSync(WHITELIST_FILE_PATH, defaults, "utf8");
  }
}

function loadWhitelistedDomains() {
  ensureWhitelistFile();
  const now = Date.now();
  if (cachedSet && now - cachedAt < CACHE_MS) return cachedSet;

  const txt = fs.readFileSync(WHITELIST_FILE_PATH, "utf8");
  const set = new Set(
    txt
      .split("\n")
      .map((l) => normalizeDomain(l))
      .filter((l) => l && !l.startsWith("#"))
  );

  cachedSet = set;
  cachedAt = now;
  return set;
}

function listWhitelistedDomains() {
  return [...loadWhitelistedDomains()].sort((a, b) => a.localeCompare(b));
}

function domainMatches(domain, allowed) {
  return domain === allowed || domain.endsWith(`.${allowed}`);
}

function isDomainWhitelisted(domain) {
  if (!domain) return false;
  const d = normalizeDomain(domain);
  if (!d) return false;

  const whitelist = loadWhitelistedDomains();
  for (const allowed of whitelist) {
    if (domainMatches(d, allowed)) return true;
  }
  return false;
}

function addDomainToWhitelist(domain) {
  ensureWhitelistFile();
  const d = normalizeDomain(domain);
  if (!d) return false;

  const set = loadWhitelistedDomains();
  if (set.has(d)) return false;

  fs.appendFileSync(WHITELIST_FILE_PATH, `\n${d}`, "utf8");
  cachedSet = null;
  return true;
}

function removeDomainFromWhitelist(domain) {
  ensureWhitelistFile();
  const d = normalizeDomain(domain);
  if (!d) return false;

  const txt = fs.readFileSync(WHITELIST_FILE_PATH, "utf8");
  const lines = txt.split("\n");
  const idx = lines.findIndex((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return false;
    return normalizeDomain(t) === d;
  });
  if (idx === -1) return false;

  lines.splice(idx, 1);
  fs.writeFileSync(WHITELIST_FILE_PATH, lines.join("\n"), "utf8");
  cachedSet = null;
  return true;
}

const addWhitelistDomain = addDomainToWhitelist;
const removeWhitelistDomain = removeDomainFromWhitelist;

module.exports = {
  WHITELIST_FILE_PATH,
  loadWhitelistedDomains,
  listWhitelistedDomains,
  isDomainWhitelisted,
  addDomainToWhitelist,
  removeDomainFromWhitelist,
  addWhitelistDomain,
  removeWhitelistDomain
};
