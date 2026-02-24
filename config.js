// config.js (ORBIT v1.1.11)
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
    version: "1.1.11",
    status: "OPERATIONAL",
    activity: "Orbit System Operational // Standing by",
  },

  // Patch notes used by /notes + startup announcements
  notes: {
    releaseDate: "February 24, 2026",
    title: "ORBIT UPDATE NOTES",
    sections: [
      {
        name: "1.1.11 - LinkGuard Cleanup",
        value:
          "- Removed WordBlocker/semantic spam checks; LinkGuard now only manages links\n" +
          "- Pruned Vectra dependency and word similarity assets\n" +
          "- MessageCreate now only tracks activity for inactivity scans\n" +
          "- /linkguard status no longer shows WordBlocker controls",
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
    // Optional: DM users when their message is blocked by LinkGuard
    dmUserOnBlock: false,
    // Optional: moderation log channel for LinkGuard violations
    // Put your channel ID here (as a string).
    violationLogChannelId: "1471586355602788493",
  },

};
