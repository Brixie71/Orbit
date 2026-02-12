// utils/whitelistManager.js
const fs = require("fs");
const path = require("path");

const WHITELIST_FILE_PATH = path.join(__dirname, "../data/whitelist_domains.txt");

let cachedSet = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000;

function ensureWhitelistFile() {
  const dir = path.dirname(WHITELIST_FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(WHITELIST_FILE_PATH)) {
    const defaults = [
      "# Whitelisted domains - one per line",
<<<<<<< HEAD
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
      "spotify.com"
    ].join("\n");

=======
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
>>>>>>> efb7cc5085eab43a9d5fa618b0fbfd4d67299f14
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
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l && !l.startsWith("#"))
  );

  cachedSet = set;
  cachedAt = now;
  return set;
}

<<<<<<< HEAD
function normalizeDomain(domain) {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
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
=======
function isDomainWhitelisted(domain) {
  if (!domain) return false;
  const d = domain.toLowerCase();
  const set = loadWhitelistedDomains();

  if (set.has(d)) return true;

  // Allow subdomains of whitelisted entries
  const parts = d.split(".");
  for (let i = 1; i < parts.length; i += 1) {
    const candidate = parts.slice(i).join(".");
    if (set.has(candidate)) return true;
>>>>>>> efb7cc5085eab43a9d5fa618b0fbfd4d67299f14
  }
  return false;
}

<<<<<<< HEAD
function addDomainToWhitelist(domain) {
  ensureWhitelistFile();
  const d = normalizeDomain(domain);
=======
function addWhitelistDomain(domain) {
  ensureWhitelistFile();
  const d = domain.trim().toLowerCase();
>>>>>>> efb7cc5085eab43a9d5fa618b0fbfd4d67299f14
  if (!d) return false;

  const set = loadWhitelistedDomains();
  if (set.has(d)) return false;

  fs.appendFileSync(WHITELIST_FILE_PATH, `\n${d}`, "utf8");
  cachedSet = null;
  return true;
}

<<<<<<< HEAD
function removeDomainFromWhitelist(domain) {
  ensureWhitelistFile();
  const d = normalizeDomain(domain);
  if (!d) return false;

  const txt = fs.readFileSync(WHITELIST_FILE_PATH, "utf8");
  const lines = txt.split("\n");
=======
function removeWhitelistDomain(domain) {
  ensureWhitelistFile();
  const d = domain.trim().toLowerCase();
  const txt = fs.readFileSync(WHITELIST_FILE_PATH, "utf8");
  const lines = txt.split("\n");

>>>>>>> efb7cc5085eab43a9d5fa618b0fbfd4d67299f14
  const idx = lines.findIndex((l) => l.trim().toLowerCase() === d);
  if (idx === -1) return false;

  lines.splice(idx, 1);
  fs.writeFileSync(WHITELIST_FILE_PATH, lines.join("\n"), "utf8");
  cachedSet = null;
  return true;
}

module.exports = {
  WHITELIST_FILE_PATH,
  loadWhitelistedDomains,
  isDomainWhitelisted,
<<<<<<< HEAD
  addDomainToWhitelist,
  removeDomainFromWhitelist
=======
  addWhitelistDomain,
  removeWhitelistDomain
>>>>>>> efb7cc5085eab43a9d5fa618b0fbfd4d67299f14
};
