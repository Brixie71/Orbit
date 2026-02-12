// config.js (ORBIT v1.1.10)
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
    systemName: "ORBIT OPERATIONS SYSTEM",
    footerText: "ORBIT OPERATIONS SYSTEM",
  },

  bot: {
    version: "1.1.10",
    status: "OPERATIONAL",
    activity: "Orbit System Operational // Standing by",
  },

  // Patch notes used by /notes + startup announcements
  notes: {
    releaseDate: "February 12, 2026",
    title: "ORBIT UPDATE NOTES",
    sections: [
      {
        name: "1.1.10 - Improved LinkGuard Performance",
        value:
          "- Added structured moderation log embeds for LinkGuard and WordBlocker\n" +
          "- Violator field now includes a clickable mention and profile/DM shortcut\n" +
          "- Added channel and Discord timestamp details for faster HR review\n" +
          "- Link logging now shows a censored display value with a copy-ready entry\n" +
          "- Reduced moderation noise by handling duplicate delete race (10008) safely",
      },
      {
        name: "Event Requests",
        value:
          "- Server selector now pulls from the SQLite registry with autocomplete\n" +
          "- Preview shows the chosen server name only for clarity\n" +
          "- Voice channel selection removed to streamline submissions",
      },
      {
        name: "Server Registry",
        value:
          "- /server add/update/delete/rename manage codes in the SQLite registry\n" +
          "- Autocomplete for selecting servers on update/delete/rename\n" +
          "- Registry powers event request server selection",
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

  // Anti-spam runtime behavior
  antispam: {
    // If true, users with ManageMessages are skipped by anti-spam checks.
    // Set false to test anti-spam/semantic checks from your own mod/admin account.
    bypassManageMessages: false,
    warnDeleteAfterMs: 5000,
  },

  // LinkGuard feature toggle defaults (if you want config-driven behavior later)
  linkguard: {
    enabledByDefault: false, // default state when guild has no stored settings
    allowWhitelistedDomains: true,
    // Optional: show short warning message in channel after deletion
    warnInChannel: true,
    warnDeleteAfterMs: 5000,
    // Optional: DM users when their message is blocked by LinkGuard/WordBlocker
    dmUserOnBlock: false,
    // Optional: moderation log channel for LinkGuard + WordBlocker violations
    // Put your channel ID here (as a string).
    violationLogChannelId: "1471586355602788493",
  },

  // Optional Vectra-backed similarity checks for WordBlocker.
  // This augments anti-spam and stays fully local (file-based index).
  wordBlocker: {
    enabled: true,
    scoreThreshold: 0.6,
    minTextLength: 4,
    topK: 1,
    vectorDimensions: 384,
    ngramSize: 3,
    indexPath: "./data/vectra/word_blocker",
    seedsFile: "./data/word_similarity.txt",
  },
};
