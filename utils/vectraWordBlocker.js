const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { LocalIndex } = require("vectra");
const config = require("../config");

const DEFAULT_DIMENSIONS = 384;
const DEFAULT_NGRAM_SIZE = 3;

let index = null;
let initPromise = null;
let status = {
  enabled: false,
  reason: "not_initialized",
  seedCount: 0,
  scoreThreshold: 0,
  indexPath: "",
};

function resolvePath(inputPath, fallbackPath) {
  const value = inputPath || fallbackPath;
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function readSeedPhrases(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function fnv1a32(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalizeVector(values) {
  let norm = 0;
  for (let i = 0; i < values.length; i += 1) norm += values[i] * values[i];
  if (norm <= 0) return values;

  const inv = 1 / Math.sqrt(norm);
  for (let i = 0; i < values.length; i += 1) values[i] *= inv;
  return values;
}

function textToVector(text, dimensions = DEFAULT_DIMENSIONS, ngramSize = DEFAULT_NGRAM_SIZE) {
  const input = String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const vec = new Array(dimensions).fill(0);
  if (!input) return vec;

  const padded = ` ${input} `;
  const size = Math.max(2, ngramSize);
  for (let i = 0; i <= padded.length - size; i += 1) {
    const gram = padded.slice(i, i + size);
    const h = fnv1a32(gram);
    const idx = h % dimensions;
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[idx] += sign;
  }

  return normalizeVector(vec);
}

function getGuardConfig() {
  return config.wordBlocker || config.semanticGuard || {};
}

function buildHash(seedLines, cfg) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        seeds: seedLines,
        dimensions: cfg.vectorDimensions ?? DEFAULT_DIMENSIONS,
        ngramSize: cfg.ngramSize ?? DEFAULT_NGRAM_SIZE,
      })
    )
    .digest("hex");
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
}

function writeManifest(manifestPath, data) {
  fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2), "utf8");
}

function buildDisabledStatus(reason, cfg, seedCount = 0, indexPath = "") {
  status = {
    enabled: false,
    reason,
    seedCount,
    scoreThreshold: cfg.scoreThreshold ?? 0.9,
    indexPath,
  };
  return status;
}

async function rebuildIndex(indexPath, seeds, cfg, hash) {
  fs.rmSync(indexPath, { recursive: true, force: true });
  fs.mkdirSync(indexPath, { recursive: true });

  index = new LocalIndex(indexPath);
  await index.createIndex();

  const dimensions = cfg.vectorDimensions ?? DEFAULT_DIMENSIONS;
  const ngramSize = cfg.ngramSize ?? DEFAULT_NGRAM_SIZE;

  for (const phrase of seeds) {
    await index.insertItem({
      vector: textToVector(phrase, dimensions, ngramSize),
      metadata: {
        kind: "word_seed",
        text: phrase,
      },
    });
  }

  writeManifest(path.join(indexPath, "orbit_manifest.json"), {
    hash,
    seedCount: seeds.length,
    updatedAt: Date.now(),
    dimensions,
    ngramSize,
  });
}

async function initializeWordBlocker() {
  const cfg = getGuardConfig();
  const indexPath = resolvePath(cfg.indexPath, "./data/vectra/word_blocker");
  const seedsFile = resolvePath(cfg.seedsFile, "./data/word_similarity.txt");

  if (!cfg.enabled) {
    return buildDisabledStatus("disabled_in_config", cfg, 0, indexPath);
  }

  const seeds = readSeedPhrases(seedsFile);
  if (!seeds.length) {
    return buildDisabledStatus("no_seed_phrases", cfg, 0, indexPath);
  }

  const expectedHash = buildHash(seeds, cfg);
  const manifestPath = path.join(indexPath, "orbit_manifest.json");
  const manifest = readManifest(manifestPath);

  const localIndex = new LocalIndex(indexPath);
  const created = await localIndex.isIndexCreated();

  const needsRebuild =
    !created ||
    !manifest ||
    manifest.hash !== expectedHash ||
    manifest.seedCount !== seeds.length;

  if (needsRebuild) {
    await rebuildIndex(indexPath, seeds, cfg, expectedHash);
  } else {
    index = localIndex;
    await index.loadIndexData();
  }

  status = {
    enabled: true,
    reason: "ready",
    seedCount: seeds.length,
    scoreThreshold: cfg.scoreThreshold ?? 0.9,
    indexPath,
  };
  return status;
}

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = initializeWordBlocker().catch((err) => {
      const cfg = getGuardConfig();
      buildDisabledStatus(`init_failed:${err?.message || "unknown"}`, cfg);
      return status;
    });
  }
  return initPromise;
}

async function findWordSimilarity(text) {
  const cfg = getGuardConfig();
  if (!cfg.enabled) return null;

  const content = String(text || "").trim();
  if (!content) return null;

  const minTextLength = cfg.minTextLength ?? 24;
  if (content.length < minTextLength) return null;

  await ensureInitialized();
  if (!status.enabled || !index) return null;

  const dimensions = cfg.vectorDimensions ?? DEFAULT_DIMENSIONS;
  const ngramSize = cfg.ngramSize ?? DEFAULT_NGRAM_SIZE;
  const threshold = cfg.scoreThreshold ?? 0.9;
  const topK = Math.max(1, cfg.topK ?? 1);

  const queryVec = textToVector(content, dimensions, ngramSize);
  const results = await index.queryItems(
    queryVec,
    "",
    topK,
    { kind: { $eq: "word_seed" } },
    false
  );

  if (!results.length) return null;

  const best = results[0];
  if ((best?.score ?? 0) < threshold) return null;

  return {
    score: best.score,
    phrase: best.item?.metadata?.text || "",
    id: best.item?.id || "",
  };
}

function getWordBlockerStatus() {
  return { ...status };
}

module.exports = {
  initializeWordBlocker,
  findWordSimilarity,
  getWordBlockerStatus,
  textToVector,
};
