// events/messageCreate.js
const { Events } = require("discord.js");
const { touchMemberActivity } = require("../utils/activity");

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    // Track member activity for inactivity scans.
    touchMemberActivity(message.guildId, message.author.id, Date.now());
  },
};
