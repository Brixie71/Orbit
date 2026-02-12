// utils/domainBlocker.js
const fs = require("fs");
const path = require("path");

const BLACKLIST_FILE_PATH = path.join(__dirname, "../data/blacklist_domains.txt");

let cachedSet = null;
let cachedMatchers = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000;

function normalizeBlacklistEntryValue(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s || s.startsWith("#")) return "";
  return s;
}

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
  const entries = new Set();

  for (const line of txt.split(/\r?\n/)) {
    const entry = normalizeBlacklistEntryValue(line);
    if (entry) entries.add(entry);
  }

  cachedSet = entries;
  cachedMatchers = buildBlacklistMatchers(entries);
  cachedAt = now;
  return cachedSet;
}

function addDomainToBlacklist(domain) {
  ensureBlacklistFile();
  const d = normalizeBlacklistEntryValue(domain);
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
  const d = normalizeBlacklistEntryValue(domain);
  if (!d) return false;

  const txt = fs.readFileSync(BLACKLIST_FILE_PATH, "utf8");
  const lines = txt.split("\n");

  const idx = lines.findIndex((line) => normalizeBlacklistEntryValue(line) === d);
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

  const raw = normalizeBlacklistEntryValue(entry);
  if (!raw) return null;

  const hasScheme = raw.includes("://");
  const hasPath = raw.includes("/");

  if (hasScheme || hasPath) {
    try {
      const url = new URL(hasScheme ? raw : `https://${raw}`);
      const host = normalizeHostname(url.hostname);
      const path = normalizePathname(url.pathname);

      if (!host) return null;
      if (path === "/") return { type: "domain", host };
      return { type: "path", host, pathPrefix: path };
    } catch {
      // fall through to domain-only handling
    }
  }

  const host = normalizeHostname(raw);
  return host ? { type: "domain", host } : null;
}

function buildBlacklistMatchers(entries) {
  const domains = new Set();
  const pathPrefixesByHost = new Map();

  for (const entry of entries) {
    const parsed = parseBlacklistEntry(entry);
    if (!parsed) continue;
    if (parsed.type === "domain") domains.add(parsed.host);
    if (parsed.type === "path") {
      const arr = pathPrefixesByHost.get(parsed.host) || [];
      arr.push(parsed.pathPrefix);
      pathPrefixesByHost.set(parsed.host, arr);
    }
  }

  for (const arr of pathPrefixesByHost.values()) {
    // Longer prefixes first so the most specific match wins.
    arr.sort((a, b) => b.length - a.length);
  }

  return { domains, pathPrefixesByHost };
}

function loadBlacklistMatchers() {
  loadBlacklistedDomains();
  return cachedMatchers || { domains: new Set(), pathPrefixesByHost: new Map() };
}

function findDomainMatch(host, domains) {
  if (!host) return null;
  if (domains.has(host)) return host;

  // Check parent domains without split/join allocations.
  let dot = host.indexOf(".");
  while (dot !== -1) {
    const candidate = host.slice(dot + 1);
    if (domains.has(candidate)) return candidate;
    dot = host.indexOf(".", dot + 1);
  }

  return null;
}

function findPathMatch(host, pathname, pathPrefixesByHost) {
  const prefixes = pathPrefixesByHost.get(host);
  if (!prefixes || prefixes.length === 0) return null;

  for (const prefix of prefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return `${host}${prefix}`;
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

  const { domains, pathPrefixesByHost } = loadBlacklistMatchers();

  const domainMatch = findDomainMatch(host, domains);
  if (domainMatch) {
    return { domain: host, url: normalized, match: domainMatch, matchType: "domain" };
  }

  const pathname = normalizePathname(urlObj.pathname);
  const pathMatch = findPathMatch(host, pathname, pathPrefixesByHost);
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
