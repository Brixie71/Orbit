module.exports = {
  // -------------------- THEME / BRANDING --------------------
  theme: {
    PRIMARY: "#0B1220",     // Orbit dark navy (embed base)
    SECONDARY: "#1E90FF",   // Orbit blue accent (highlights)
    SUCCESS: "#22C55E",     // Green
    WARNING: "#FACC15",     // Yellow
    ERROR: "#EF4444"        // Red
  },

  branding: {
    name: "ORBIT",
    systemName: "🛰️ ORBIT OPERATIONS SYSTEM",
    footerText: "🛰️ ORBIT OPERATIONS SYSTEM",
    // Optional: if you want a consistent icon instead of bot avatar
    // iconURL: "https://..."
  },

  // -------------------- ORG STRUCTURE (optional: keep if you still use it) --------------------
  // You can rename/repurpose these later; leaving structure intact avoids breaking other code.
  companies: {
    Alpha: { prefix: "A", color: "#EF4444", motto: "First in, Last out." },
    Bravo: { prefix: "B", color: "#3B82F6", motto: "Swift and Decisive." },
    Charlie: { prefix: "C", color: "#22C55E", motto: "Anywhere, Anytime." },
    Delta: { prefix: "D", color: "#FACC15", motto: "Force Multiplied." },
    Echo:  { prefix: "E", color: "#A855F7", motto: "Beyond Limits." }
  },

  // -------------------- BOT CONFIG --------------------
  bot: {
    version: "1.2.0 - ORBIT OPS UPDATE",
    status: "OPERATIONAL",
    activity: "Orbit Ops Net // Standing by"
  },

  // -------------------- OPS DEFAULTS (used by /eventrequest or future features) --------------------
  ops: {
    userCooldownMs: 60_000,        // 1 min anti-spam
    channelCooldownMs: 30_000,     // 30 sec anti-flood
    duplicateWindowMs: 5 * 60_000,// 30 min duplicate guard
    previewExpiryMs: 5 * 60_000,   // 30 min confirm window

     // NEW: restrict /eventrequest usage
    eventRequestChannelId: "1464991886560329951"
  }
  
};
