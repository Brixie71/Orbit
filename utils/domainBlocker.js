// utils/domainBlocker.js
const fs = require("fs");
const path = require("path");
const db = require("./db");

const BLACKLIST_FILE_PATH = path.join(__dirname, "../data/blacklist_domains.txt");
const BLACKLIST_DB_TABLE = "domain_blacklist_entries";
const BLACKLIST_META_TABLE = "domain_blacklist_meta";
const READ_CHUNK_SIZE = 1024 * 1024;

let cachedSignature = null;

db.exec(`
CREATE TABLE IF NOT EXISTS ${BLACKLIST_DB_TABLE} (
  entry TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  path_prefix TEXT
);
CREATE INDEX IF NOT EXISTS idx_${BLACKLIST_DB_TABLE}_host
  ON ${BLACKLIST_DB_TABLE} (host);

CREATE TABLE IF NOT EXISTS ${BLACKLIST_META_TABLE} (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  file_signature TEXT NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  synced_at INTEGER NOT NULL
);
`);

const getMetaStmt = db.prepare(
  `SELECT file_signature, total_count FROM ${BLACKLIST_META_TABLE} WHERE id = 1`
);
const upsertMetaStmt = db.prepare(`
INSERT INTO ${BLACKLIST_META_TABLE} (id, file_signature, total_count, synced_at)
VALUES (1, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  file_signature = excluded.file_signature,
  total_count = excluded.total_count,
  synced_at = excluded.synced_at
`);
const clearEntriesStmt = db.prepare(`DELETE FROM ${BLACKLIST_DB_TABLE}`);
const insertEntryStmt = db.prepare(`
INSERT OR IGNORE INTO ${BLACKLIST_DB_TABLE} (entry, host, path_prefix)
VALUES (?, ?, ?)
`);
const countEntriesStmt = db.prepare(`SELECT COUNT(*) AS count FROM ${BLACKLIST_DB_TABLE}`);
const hasDomainStmt = db.prepare(`
SELECT 1
FROM ${BLACKLIST_DB_TABLE}
WHERE host = ? AND path_prefix IS NULL
LIMIT 1
`);
const hasExactEntryStmt = db.prepare(`
SELECT 1
FROM ${BLACKLIST_DB_TABLE}
WHERE entry = ?
LIMIT 1
`);
const deleteExactEntryStmt = db.prepare(`
DELETE FROM ${BLACKLIST_DB_TABLE}
WHERE entry = ?
`);
const selectPathPrefixesStmt = db.prepare(`
SELECT path_prefix
FROM ${BLACKLIST_DB_TABLE}
WHERE host = ? AND path_prefix IS NOT NULL
ORDER BY LENGTH(path_prefix) DESC
`);

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
      "discordgift.co",
    ].join("\n");
    fs.writeFileSync(BLACKLIST_FILE_PATH, defaultDomains, "utf8");
  }
}

function getBlacklistFileSignature() {
  const stats = fs.statSync(BLACKLIST_FILE_PATH);
  return `${stats.size}:${Math.trunc(stats.mtimeMs)}`;
}

function forEachBlacklistLineSync(filePath, onLine) {
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(READ_CHUNK_SIZE);
  let leftover = "";

  try {
    while (true) {
      const bytesRead = fs.readSync(fd, buffer, 0, READ_CHUNK_SIZE, null);
      if (bytesRead <= 0) break;

      const chunk = leftover + buffer.toString("utf8", 0, bytesRead);
      const lines = chunk.split("\n");
      leftover = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
        onLine(line);
      }
    }

    if (leftover) {
      const line = leftover.endsWith("\r") ? leftover.slice(0, -1) : leftover;
      onLine(line);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function entryToStorageKey(entry) {
  if (!entry) return "";
  if (entry.type === "path") return `${entry.host}${entry.pathPrefix}`;
  return entry.host;
}

const rebuildBlacklistIndexTx = db.transaction((fileSignature) => {
  clearEntriesStmt.run();

  let inserted = 0;
  forEachBlacklistLineSync(BLACKLIST_FILE_PATH, (line) => {
    const normalized = normalizeBlacklistEntryValue(line);
    if (!normalized) return;

    const parsed = parseBlacklistEntry(normalized);
    if (!parsed) return;

    const key = entryToStorageKey(parsed);
    const pathPrefix = parsed.type === "path" ? parsed.pathPrefix : null;
    inserted += insertEntryStmt.run(key, parsed.host, pathPrefix).changes;
  });

  upsertMetaStmt.run(fileSignature, inserted, Date.now());
});

function ensureBlacklistIndexUpToDate() {
  ensureBlacklistFile();
  const signature = getBlacklistFileSignature();
  if (signature === cachedSignature) return;

  const meta = getMetaStmt.get();
  if (meta?.file_signature === signature) {
    cachedSignature = signature;
    return;
  }

  rebuildBlacklistIndexTx(signature);
  cachedSignature = signature;
}

function getBlacklistedDomainCount() {
  ensureBlacklistIndexUpToDate();
  return countEntriesStmt.get().count;
}

function loadBlacklistedDomains() {
  // Backwards-compatible shape for existing status display usage (.size).
  return { size: getBlacklistedDomainCount() };
}

function addDomainToBlacklist(domain) {
  ensureBlacklistFile();
  const normalized = normalizeBlacklistEntryValue(domain);
  if (!normalized) return false;

  const parsed = parseBlacklistEntry(normalized);
  if (!parsed) return false;

  ensureBlacklistIndexUpToDate();

  const key = entryToStorageKey(parsed);
  if (hasExactEntryStmt.get(key)) return false;

  fs.appendFileSync(BLACKLIST_FILE_PATH, `\n${normalized}`, "utf8");
  insertEntryStmt.run(key, parsed.host, parsed.type === "path" ? parsed.pathPrefix : null);

  const signature = getBlacklistFileSignature();
  const total = countEntriesStmt.get().count;
  upsertMetaStmt.run(signature, total, Date.now());
  cachedSignature = signature;
  return true;
}

function removeEntryFromBlacklistFile(normalizedEntry) {
  const tmpPath = `${BLACKLIST_FILE_PATH}.tmp`;
  const outFd = fs.openSync(tmpPath, "w");
  let removed = false;
  let wroteLine = false;

  try {
    forEachBlacklistLineSync(BLACKLIST_FILE_PATH, (line) => {
      const normalizedLine = normalizeBlacklistEntryValue(line);
      if (!removed && normalizedLine === normalizedEntry) {
        removed = true;
        return;
      }

      const chunk = wroteLine ? `\n${line}` : line;
      fs.writeSync(outFd, chunk);
      wroteLine = true;
    });
  } finally {
    fs.closeSync(outFd);
  }

  if (!removed) {
    fs.unlinkSync(tmpPath);
    return false;
  }

  fs.renameSync(tmpPath, BLACKLIST_FILE_PATH);
  return true;
}

function removeDomainFromBlacklist(domain) {
  ensureBlacklistFile();
  const normalized = normalizeBlacklistEntryValue(domain);
  if (!normalized) return false;

  const parsed = parseBlacklistEntry(normalized);
  if (!parsed) return false;

  ensureBlacklistIndexUpToDate();
  if (!removeEntryFromBlacklistFile(normalized)) return false;

  const key = entryToStorageKey(parsed);
  deleteExactEntryStmt.run(key);

  const signature = getBlacklistFileSignature();
  const total = countEntriesStmt.get().count;
  upsertMetaStmt.run(signature, total, Date.now());
  cachedSignature = signature;
  return true;
}

function extractUrls(text) {
  if (!text) return [];
  const urlRegex = /\bhttps?:\/\/[^\s<]+|\bwww\.[^\s<]+/gi;
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
      const pathValue = normalizePathname(url.pathname);

      if (!host) return null;
      if (pathValue === "/") return { type: "domain", host };
      return { type: "path", host, pathPrefix: pathValue };
    } catch {
      // fall through to domain-only handling
    }
  }

  const host = normalizeHostname(raw);
  return host ? { type: "domain", host } : null;
}

function findDomainMatch(host) {
  if (!host) return null;
  if (hasDomainStmt.get(host)) return host;

  // Check parent domains without split/join allocations.
  let dot = host.indexOf(".");
  while (dot !== -1) {
    const candidate = host.slice(dot + 1);
    if (hasDomainStmt.get(candidate)) return candidate;
    dot = host.indexOf(".", dot + 1);
  }

  return null;
}

function findPathMatch(host, pathname) {
  const rows = selectPathPrefixesStmt.all(host);
  if (!rows.length) return null;

  for (const row of rows) {
    const prefix = row.path_prefix;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return `${host}${prefix}`;
    }
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

  ensureBlacklistIndexUpToDate();

  const domainMatch = findDomainMatch(host);
  if (domainMatch) {
    return { domain: host, url: normalized, match: domainMatch, matchType: "domain" };
  }

  const pathname = normalizePathname(urlObj.pathname);
  const pathMatch = findPathMatch(host, pathname);
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
  getBlacklistedDomainCount,
  addDomainToBlacklist,
  removeDomainFromBlacklist,
  extractUrls,
  normalizeUrl,
  getDomainFromUrl,
  analyzeURL,
  findBlacklistedUrl,
  findBlacklistedInMessage,
};
