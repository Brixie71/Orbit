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
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l && !l.startsWith("#"))
  );

  cachedSet = set;
  cachedAt = now;
  return set;
}

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
  }
  return false;
}

function addWhitelistDomain(domain) {
  ensureWhitelistFile();
  const d = domain.trim().toLowerCase();
  if (!d) return false;

  const set = loadWhitelistedDomains();
  if (set.has(d)) return false;

  fs.appendFileSync(WHITELIST_FILE_PATH, `\n${d}`, "utf8");
  cachedSet = null;
  return true;
}

function removeWhitelistDomain(domain) {
  ensureWhitelistFile();
  const d = domain.trim().toLowerCase();
  const txt = fs.readFileSync(WHITELIST_FILE_PATH, "utf8");
  const lines = txt.split("\n");

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
  addWhitelistDomain,
  removeWhitelistDomain
};
