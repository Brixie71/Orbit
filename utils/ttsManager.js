// utils/ttsManager.js
// Orbit TTS Manager (Gemini TTS) with:
// - Per-guild voice connection + audio player
// - FIFO queue (no overlap)
// - Token-bucket rate limiting (per-guild + per-user)
// - "Follow channel" support (auto-read newest chat)
// REQUIREMENTS:
//   npm i @discordjs/voice prism-media ffmpeg-static wav @google/genai
// ENV:
//   GEMINI_API_KEY=...

const { Readable } = require("stream");
const prism = require("prism-media");
const ffmpegPath = require("ffmpeg-static");
const wav = require("wav");

const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  entersState,
} = require("@discordjs/voice");

// -------------------- Rate Limiter (token bucket) --------------------
function makeTokenBucket({ capacity, refillPerMs }) {
  return { capacity, refillPerMs, tokens: capacity, last: Date.now() };
}

function takeToken(bucket, cost = 1) {
  const now = Date.now();
  const delta = now - bucket.last;
  bucket.last = now;

  // refill
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + delta * bucket.refillPerMs);

  if (bucket.tokens < cost) return false;
  bucket.tokens -= cost;
  return true;
}

// -------------------- Gemini TTS helpers --------------------
// Gemini SDK is often ESM-first; we use dynamic import to keep Orbit CommonJS.
async function geminiSynthesizePcmBase64(text, voiceName = "Kore") {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY in environment.");

  const { GoogleGenAI } = await import("@google/genai");

  const ai = new GoogleGenAI({ apiKey: key });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const b64 = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error("Gemini TTS returned no audio data.");

  return b64;
}

// Wrap raw PCM in a WAV container (default 24kHz mono 16-bit)
async function pcmBase64ToWavBuffer(b64, { channels = 1, rate = 24000, sampleWidth = 2 } = {}) {
  const pcm = Buffer.from(b64, "base64");

  return new Promise((resolve, reject) => {
    const chunks = [];
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on("data", (d) => chunks.push(d));
    writer.on("finish", () => resolve(Buffer.concat(chunks)));
    writer.on("error", reject);

    writer.end(pcm);
  });
}

async function geminiTtsToWavBuffer(text, voiceName) {
  const b64 = await geminiSynthesizePcmBase64(text, voiceName);
  return pcmBase64ToWavBuffer(b64, { channels: 1, rate: 24000, sampleWidth: 2 });
}

// Convert WAV(24k mono) -> 48k stereo s16le PCM stream for Discord voice
function wavBufferToDiscordResource(wavBuffer) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static not found. Install ffmpeg-static or provide FFmpeg in PATH.");
  }

  const input = Readable.from(wavBuffer);

  const ffmpeg = new prism.FFmpeg({
    executable: ffmpegPath,
    args: [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-f",
      "s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "pipe:1",
    ],
  });

  const pcmStream = input.pipe(ffmpeg);

  // StreamType.Raw = 48kHz 2ch signed 16-bit little-endian PCM
  return createAudioResource(pcmStream, { inputType: StreamType.Raw });
}

// -------------------- TTS Manager --------------------
class TTSManager {
  constructor(opts = {}) {
    this.guild = new Map();

    // Defaults (tune as needed)
    this.voiceName = opts.voiceName || "Kore";

    // Queue protections
    this.maxQueueLength = Number.isFinite(opts.maxQueueLength) ? opts.maxQueueLength : 30;

    // Rate limits
    // Guild: 8 msgs/min (burst 8)
    this.guildCapacity = opts.guildCapacity ?? 8;
    this.guildPerMinute = opts.guildPerMinute ?? 8;

    // User: burst 2, refill to 2 per 20 seconds
    this.userCapacity = opts.userCapacity ?? 2;
    this.userRefillMs = opts.userRefillMs ?? 20000;
  }

  _get(guildId) {
    if (!this.guild.has(guildId)) {
      const player = createAudioPlayer();
      const state = {
        connection: null,
        player,
        queue: [],
        playing: false,

        followChannelId: null,

        // Rate limiters
        guildBucket: makeTokenBucket({
          capacity: this.guildCapacity,
          refillPerMs: this.guildPerMinute / 60000,
        }),
        userBuckets: new Map(), // userId -> bucket

        // Debounce/health
        lastErrorAt: 0,
      };

      // When idle, continue draining
      player.on(AudioPlayerStatus.Idle, () => {
        state.playing = false;
        this._drain(guildId).catch(() => {});
      });

      // If player errors, skip and continue
      player.on("error", () => {
        state.playing = false;
        this._drain(guildId).catch(() => {});
      });

      this.guild.set(guildId, state);
    }
    return this.guild.get(guildId);
  }

  // ----- VC connection management -----
  setConnection(guildId, connection) {
    const s = this._get(guildId);

    // Replace existing connection safely
    try {
      s.connection?.destroy();
    } catch {}

    s.connection = connection;
    s.connection.subscribe(s.player);
  }

  disconnect(guildId) {
    const s = this._get(guildId);
    try {
      s.connection?.destroy();
    } catch {}
    s.connection = null;

    this.setFollowChannel(guildId, null);
    this.clearQueue(guildId);
  }

  isConnected(guildId) {
    const s = this._get(guildId);
    return !!s.connection;
  }

  // ----- Follow mode -----
  setFollowChannel(guildId, channelIdOrNull) {
    const s = this._get(guildId);
    s.followChannelId = channelIdOrNull || null;
  }

  getFollowChannel(guildId) {
    const s = this._get(guildId);
    return s.followChannelId;
  }

  // ----- Rate limiting -----
  allow(guildId, userId) {
    const s = this._get(guildId);

    // guild-level limit
    if (!takeToken(s.guildBucket, 1)) return false;

    // user-level bucket
    let b = s.userBuckets.get(userId);
    if (!b) {
      b = makeTokenBucket({
        capacity: this.userCapacity,
        refillPerMs: this.userCapacity / this.userRefillMs,
      });
      s.userBuckets.set(userId, b);
    }

    return takeToken(b, 1);
  }

  // ----- Queue operations -----
  clearQueue(guildId) {
    const s = this._get(guildId);
    s.queue = [];
  }

  queueLength(guildId) {
    const s = this._get(guildId);
    return s.queue.length;
  }

  async enqueue({ guildId, text }) {
    const s = this._get(guildId);
    if (!s.connection) return false;

    const clean = String(text || "").trim();
    if (!clean) return false;

    // Queue cap to prevent memory abuse
    if (s.queue.length >= this.maxQueueLength) {
      // Drop oldest (or newest). Here: drop oldest to keep “newest chat” more relevant.
      s.queue.shift();
    }

    s.queue.push(clean);

    if (!s.playing) {
      s.playing = true;
      await this._drain(guildId);
    }

    return true;
  }

  async _drain(guildId) {
    const s = this._get(guildId);
    if (!s.connection) return;

    // If already playing, do nothing
    if (s.player.state.status === AudioPlayerStatus.Playing) return;

    const next = s.queue.shift();
    if (!next) return;

    try {
      // 1) TTS -> WAV buffer (24kHz mono)
      const wavBuf = await geminiTtsToWavBuffer(next, this.voiceName);

      // 2) WAV -> Discord resource (48kHz stereo PCM stream)
      const resource = wavBufferToDiscordResource(wavBuf);

      s.player.play(resource);

      // Optional: ensure it actually transitions to Playing
      try {
        await entersState(s.player, AudioPlayerStatus.Playing, 7000);
      } catch {
        // If it never starts, move on
        s.playing = false;
        await this._drain(guildId);
      }
    } catch (err) {
      // Prevent tight error loops
      const now = Date.now();
      if (now - s.lastErrorAt > 2000) {
        s.lastErrorAt = now;
        // You can log err.message in your bot logger if desired
        // console.error("[TTS] drain error:", err);
      }

      s.playing = false;
      // Continue to next message
      await this._drain(guildId);
    }
  }
}

module.exports = { TTSManager };
