// utils/domainBlocker.js
const fs = require("fs");
const path = require("path");

const BLACKLIST_FILE_PATH = path.join(__dirname, "../data/blacklist_domains.txt");

let cachedSet = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000;

function ensureBlacklistFile() {
  const dir = path.dirname(BLACKLIST_FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(BLACKLIST_FILE_PATH)) {
    const defaultDomains = [
      "# Blacklisted domains - one per line",
      "discord-nitro.ru",
      "free-nitro.com",
      "steamcommunnitty.ru",
      "discordgift.co"
    ].join("\n");
    fs.writeFileSync(BLACKLIST_FILE_PATH, defaultDomains, "utf8");
  }
}

function loadBlacklistedDomains() {
  ensureBlacklistFile();
  const now = Date.now();
  if (cachedSet && now - cachedAt < CACHE_MS) return cachedSet;

  const txt = fs.readFileSync(BLACKLIST_FILE_PATH, "utf8");
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

function addDomainToBlacklist(domain) {
  ensureBlacklistFile();
  const d = domain.trim().toLowerCase();
  if (!d) return false;

  const set = loadBlacklistedDomains();
  if (set.has(d)) return false;

  fs.appendFileSync(BLACKLIST_FILE_PATH, `\n${d}`, "utf8");
  cachedSet = null;
  return true;
}

function removeDomainFromBlacklist(domain) {
  ensureBlacklistFile();
  const d = domain.trim().toLowerCase();
  const txt = fs.readFileSync(BLACKLIST_FILE_PATH, "utf8");
  const lines = txt.split("\n");

  const idx = lines.findIndex((l) => l.trim().toLowerCase() === d);
  if (idx === -1) return false;

  lines.splice(idx, 1);
  fs.writeFileSync(BLACKLIST_FILE_PATH, lines.join("\n"), "utf8");
  cachedSet = null;
  return true;
}

function extractUrls(text) {
  if (!text) return [];
  const urlRegex =
    /\bhttps?:\/\/[^\s<]+|\bwww\.[^\s<]+/gi;
  return Array.from(text.match(urlRegex) || []);
}

function normalizeUrl(u) {
  if (!u) return null;
  const s = u.trim();
  if (s.toLowerCase().startsWith("http://") || s.toLowerCase().startsWith("https://")) return s;
  if (s.toLowerCase().startsWith("www.")) return `https://${s}`;
  return null;
}

function getDomainFromUrl(u) {
  try {
    const url = new URL(normalizeUrl(u));
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function analyzeURL(url) {
  const domain = getDomainFromUrl(url);
  const result = { riskLevel: "safe", reasons: [], domain };

  if (!domain) {
    result.riskLevel = "unknown";
    result.reasons.push("Unable to parse domain.");
    return result;
  }

  const blacklist = loadBlacklistedDomains();
  if (blacklist.has(domain)) {
    result.riskLevel = "high";
    result.reasons.push("Domain is blacklisted.");
    return result;
  }

  // lightweight heuristic
  const phishingWords = ["nitro", "gift", "steam", "discord", "verify", "login", "free"];
  if (phishingWords.some((w) => domain.includes(w))) {
    result.riskLevel = "medium";
    result.reasons.push("Domain contains common phishing keywords.");
  }

  return result;
}

function findBlacklistedInMessage(messageContent) {
  const urls = extractUrls(messageContent).map(normalizeUrl).filter(Boolean);
  const blacklist = loadBlacklistedDomains();

  for (const u of urls) {
    const d = getDomainFromUrl(u);
    if (d && blacklist.has(d)) {
      return { domain: d, url: u };
    }
  }
  return null;
}

module.exports = {
  BLACKLIST_FILE_PATH,
  loadBlacklistedDomains,
  addDomainToBlacklist,
  removeDomainFromBlacklist,
  extractUrls,
  normalizeUrl,
  getDomainFromUrl,
  analyzeURL,
  findBlacklistedInMessage
};
