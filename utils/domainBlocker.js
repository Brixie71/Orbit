// utils/domainBlocker.js
const fs = require("fs");
const path = require("path");

const BLACKLIST_FILE_PATH = path.join(__dirname, "../data/blacklist_domains.txt");

let cachedSet = null;
let cachedMatchers = null;
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
  const entries = txt
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith("#"));

  cachedSet = new Set(entries);
  cachedMatchers = buildBlacklistMatchers(entries);
  cachedAt = now;
  return cachedSet;
}

function addDomainToBlacklist(domain) {
  ensureBlacklistFile();
  const d = domain.trim().toLowerCase();
  if (!d) return false;

  const set = loadBlacklistedDomains();
  if (set.has(d)) return false;

  fs.appendFileSync(BLACKLIST_FILE_PATH, `\n${d}`, "utf8");
  cachedSet = null;
  cachedMatchers = null;
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
  cachedMatchers = null;
  return true;
}

function extractUrls(text) {
  if (!text) return [];
  const urlRegex =
    /\bhttps?:\/\/[^\s<]+|\bwww\.[^\s<]+/gi;
  const bareDomainRegex =
    /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{2,5})?(?:\/[^\s<]*)?/gi;

  const results = new Set();

  for (const match of text.match(urlRegex) || []) {
    results.add(match);
  }

  for (const match of text.matchAll(bareDomainRegex)) {
    const value = match[0];
    const idx = match.index ?? 0;
    const prev = idx >= 3 ? text.slice(idx - 3, idx) : "";
    const prevChar = idx > 0 ? text[idx - 1] : "";

    if (prev === "://") continue; // already captured by scheme-based regex
    if (prevChar === "@") continue; // avoid emails (e.g., user@domain.com)

    results.add(value);
  }

  return Array.from(results);
}

function stripTrailingPunctuation(value) {
  return value.replace(/[),.;!?]+$/g, "");
}

function normalizeUrl(u) {
  if (!u) return null;
  const s = stripTrailingPunctuation(u.trim());
  if (s.toLowerCase().startsWith("http://") || s.toLowerCase().startsWith("https://")) return s;
  if (s.toLowerCase().startsWith("www.")) return `https://${s}`;
  const hostPart = s.split("/")[0];
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{2,5})?$/i.test(hostPart)) return `https://${s}`;
  return null;
}

function normalizeHostname(hostname) {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") return "/";
  let p = pathname.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

function getDomainFromUrl(u) {
  try {
    const url = new URL(normalizeUrl(u));
    return normalizeHostname(url.hostname);
  } catch {
    return null;
  }
}

function parseBlacklistEntry(entry) {
  if (!entry) return null;

  const raw = entry.trim().toLowerCase();
  if (!raw || raw.startsWith("#")) return null;

  const hasScheme = raw.includes("://");
  const hasPath = raw.includes("/");

  if (hasScheme || hasPath) {
    try {
      const url = new URL(hasScheme ? raw : `https://${raw}`);
      const host = normalizeHostname(url.hostname);
      const path = normalizePathname(url.pathname);

      if (!host) return null;
      if (path === "/") return { type: "domain", host };
      return { type: "path", host, prefix: `${host}${path}` };
    } catch {
      // fall through to domain-only handling
    }
  }

  const host = normalizeHostname(raw);
  return host ? { type: "domain", host } : null;
}

function buildBlacklistMatchers(entries) {
  const domains = new Set();
  const pathPrefixes = new Set();

  for (const entry of entries) {
    const parsed = parseBlacklistEntry(entry);
    if (!parsed) continue;
    if (parsed.type === "domain") domains.add(parsed.host);
    if (parsed.type === "path") pathPrefixes.add(parsed.prefix);
  }

  return { domains, pathPrefixes };
}

function loadBlacklistMatchers() {
  if (!cachedMatchers) loadBlacklistedDomains();
  return cachedMatchers || { domains: new Set(), pathPrefixes: new Set() };
}

function findDomainMatch(host, domains) {
  if (!host) return null;
  const parts = host.split(".");
  for (let i = 0; i < parts.length; i += 1) {
    const candidate = parts.slice(i).join(".");
    if (domains.has(candidate)) return candidate;
  }
  return null;
}

function findPathMatch(hostPath, pathPrefixes) {
  for (const prefix of pathPrefixes) {
    if (hostPath === prefix || hostPath.startsWith(`${prefix}/`)) return prefix;
  }
  return null;
}

function findBlacklistedUrl(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;

  let urlObj;
  try {
    urlObj = new URL(normalized);
  } catch {
    return null;
  }

  const host = normalizeHostname(urlObj.hostname);
  if (!host) return null;

  const { domains, pathPrefixes } = loadBlacklistMatchers();

  const domainMatch = findDomainMatch(host, domains);
  if (domainMatch) {
    return { domain: host, url: normalized, match: domainMatch, matchType: "domain" };
  }

  const pathname = normalizePathname(urlObj.pathname);
  const hostPath = pathname === "/" ? host : `${host}${pathname}`;
  const pathMatch = findPathMatch(hostPath, pathPrefixes);
  if (pathMatch) {
    return { domain: host, url: normalized, match: pathMatch, matchType: "path" };
  }

  return null;
}

function analyzeURL(url) {
  const domain = getDomainFromUrl(url);
  const result = { riskLevel: "safe", reasons: [], domain };

  if (!domain) {
    result.riskLevel = "unknown";
    result.reasons.push("Unable to parse domain.");
    return result;
  }

  const hit = findBlacklistedUrl(url);
  if (hit) {
    result.riskLevel = "high";
    result.reasons.push(
      hit.matchType === "path" ? "URL prefix is blacklisted." : "Domain is blacklisted."
    );
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
  const urls = extractUrls(messageContent);

  for (const u of urls) {
    const hit = findBlacklistedUrl(u);
    if (hit) return hit;
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
  findBlacklistedUrl,
  findBlacklistedInMessage
};
