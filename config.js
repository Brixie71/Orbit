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
    version: "1.1.4", // <= bump this when you deploy updates
    status: "OPERATIONAL",
    activity: "Orbit Ops Net // Standing by",
  },

  // NEW: local asset paths (relative to project root)
  // Use these with AttachmentBuilder + attachment://filename.png
  assets: {
    // Put these files in /assets/
    startupBannerPath: "banner/UDOD_ORBIT.png",
    notesBannerPath: "banner/UDOD_ORBIT.png",
    serverBannerPath: "banner/server.png",
  },

  // Patch notes used by /notes + startup announcements
  notes: {
    releaseDate: "January 26, 2026",
    title: "ORBIT UPDATE NOTES",
    sections: [
      {
        name: "🧾 Startup Notification",
        value: "• Added Startup Channel Notification",
      },
      {
        name: "🧾 Event Request System",
        value:
          "• Command : /eventrequest\n" +
          "• Added Preview → Confirm dispatch flow\n" +
          "• Added cooldowns + duplicate detection",
      },
      {
        name: "🔒 Safety & Controls",
        value:
          "• AllowedMentions hardened\n" +
          "• Rate-limits on commands",
      },
      {
        name: "🧾 Server List",
        value:
          "• Command : /server list\n" +
          "• Added server code selection + /server list",
      },
    ],
  },

  // OPS DEFAULTS (used by /eventrequest or future features)
  ops: {
    userCooldownMs: 60_000,              // 1 min anti-spam
    channelCooldownMs: 30_000,           // 30 sec anti-flood
    duplicateWindowMs: 30 * 60_000,      // 30 min duplicate guard
    previewExpiryMs: 30 * 60_000,        // 30 min confirm window

    // Restrict /eventrequest usage
    eventRequestChannelId: "1464991886560329951",
  },
  
  inactivity: {
    enabled: true,
    thresholdDays: 30,
    scanEveryMinutes: 60,
    roleName: "INACTIVE",
    nicknamePrefix: "INACTIVE | "
  },
};
