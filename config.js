// config.js (ORBIT v1.1.5)
module.exports = {
  theme: {
    PRIMARY: "#0B1220",
    SECONDARY: "#1E90FF",
    SUCCESS: "#22C55E",
    WARNING: "#FACC15",
    ERROR: "#EF4444",
  },

  branding: {
    name: "ORBIT",
    systemName: "🛰️ ORBIT OPERATIONS SYSTEM",
    footerText: "🛰️ ORBIT OPERATIONS SYSTEM",
  },

  bot: {
    version: "1.1.7", // ✅ bumped for this release
    status: "OPERATIONAL",
    activity: "Orbit System Operational // Standing by",
  },

  // Patch notes used by /notes + startup announcements
  notes: {
    releaseDate: "February 5, 2026",
    title: "ORBIT UPDATE NOTES",
    sections: [
      {
        name: "🛡️ LinkGuard Update",
        value:
          "• Added whitelist support (trusted domains)\n" +
          "• Default allow list: Google Docs/Drive + Medal\n" +
          "• Blocks blacklisted subdomains + URL path prefixes\n" +
          "• Detects bare links (no http/https)\n" +
          "• Cleaner in-channel warnings for blocked links",
      },
    ],
  },

  // OPS defaults (used by /eventrequest or future features)
  ops: {
    userCooldownMs: 60_000,              // 1 min anti-spam (command submit)
    channelCooldownMs: 30_000,           // 30 sec anti-flood (confirm dispatch)
    duplicateWindowMs: 30 * 60_000,      // 30 min duplicate guard
    previewExpiryMs: 30 * 60_000,        // 30 min confirm window

    // Restrict /eventrequest usage
    eventRequestChannelId: "1464991886560329951",
  },

  // Inactivity feature (role + nickname prefix)
  inactivity: {
    enabled: true,
    thresholdDays: 30,
    scanEveryMinutes: 60,
    roleName: "INACTIVE",
    nicknamePrefix: "INACTIVE | ",
  },

  // LinkGuard feature toggle defaults (if you want config-driven behavior later)
  linkguard: {
    enabledByDefault: false, // default state when guild has no stored settings
    allowWhitelistedDomains: true,
    // Optional: show short warning message in channel after deletion
    warnInChannel: true,
    warnDeleteAfterMs: 5000,
  },
};
