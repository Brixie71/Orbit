const { EmbedBuilder } = require("discord.js");
const config = require("../config");

/**
 * Orbit embed factory (consistent branding + safe defaults)
 * @param {string} title
 * @param {string} description
 * @param {string} color
 * @param {object} options
 * @returns {EmbedBuilder}
 */
function createStyledEmbed(title, description, color, options = {}) {
  const {
    footerText = config.branding?.footerText || "🛰️ ORBIT OPERATIONS SYSTEM",
    iconURL = config.branding?.iconURL, // optional override in config
    showTimestamp = true,
    titleStyle = "orbit" // "orbit" | "plain" | "brackets"
  } = options;

  const styledTitle =
    titleStyle === "plain"
      ? title
      : titleStyle === "brackets"
        ? `【 ${title} 】`
        : `⟡ ${title} ⟡`;

  const embed = new EmbedBuilder()
    .setTitle(styledTitle)
    .setDescription(description || "\u200B")
    .setColor(color || config.theme.PRIMARY);

  const resolvedIcon =
    iconURL ||
    global.client?.user?.displayAvatarURL?.() ||
    null;

  embed.setFooter({
    text: footerText,
    ...(resolvedIcon ? { iconURL: resolvedIcon } : {})
  });

  if (showTimestamp) embed.setTimestamp();

  return embed;
}

module.exports = { createStyledEmbed };
