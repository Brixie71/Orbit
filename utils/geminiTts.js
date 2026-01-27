// utils/geminiTts.js
const wav = require("wav");

async function synthesizePcmBase64(text, voiceName = "Kore") {
  const { GoogleGenAI } = await import("@google/genai");

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const resp = await ai.models.generateContent({
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

  const b64 =
    resp?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!b64) {
    throw new Error("No audio data returned from Gemini TTS.");
  }

  return b64;
}

// Wrap raw PCM in a WAV container (still 24kHz)
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

async function geminiTtsToWav(text, voiceName) {
  const b64 = await synthesizePcmBase64(text, voiceName);
  return pcmBase64ToWavBuffer(b64, { channels: 1, rate: 24000, sampleWidth: 2 });
}

module.exports = { geminiTtsToWav };
