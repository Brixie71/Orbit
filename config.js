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
    version: "1.1.9", // ✅ bumped for this release
    status: "OPERATIONAL",
    activity: "Orbit System Operational // Standing by",
  },

  // Patch notes used by /notes + startup announcements
  notes: {
    releaseDate: "February 9, 2026",
    title: "ORBIT UPDATE NOTES",
    sections: [
      {
        name: "🛰️ Event Requests",
        value:
          "• Server selector now pulls from the SQLite registry with autocomplete\n" +
          "• Preview shows the chosen server name only for clarity\n" +
          "• Voice channel selection removed to streamline submissions",
      },
      {
        name: "🛰️ Server Registry",
        value:
          "• /server add/update/delete/rename manage codes in the SQLite registry\n" +
          "• Autocomplete for selecting servers on update/delete/rename\n" +
          "• Registry powers event request server selection",
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
