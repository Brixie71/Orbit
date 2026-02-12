const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { createStyledEmbed } = require("../utils/embedCreator");
const config = require("../config");
const {
  listServerCodes,
  getServerCode,
  upsertServerCode,
  addServerCode,
  deleteServerCode,
} = require("../utils/serverCodes");

function normalizeServerKey(name) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

function buildAutocompleteChoices(rows, focused) {
  const needle = (focused || "").toLowerCase();
  return rows
    .filter((row) => {
      if (!needle) return true;
      return (
        row.server_key.toLowerCase().includes(needle) ||
        row.name.toLowerCase().includes(needle)
      );
    })
    .slice(0, 25)
    .map((row) => ({
      name: `${row.server_key} — ${row.name}`,
      value: row.server_key,
    }));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Display server codes")
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List all BRM5 server codes")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Admin: add a server code")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Server name")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("server_code")
            .setDescription("Server code")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("confirm")
            .setDescription("Confirm add")
            .setRequired(true)
            .addChoices(
              { name: "yes", value: "yes" },
              { name: "no", value: "no" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Admin: update a server code")
        .addStringOption((opt) =>
          opt
            .setName("server")
            .setDescription("Select a server")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("server_code")
            .setDescription("New server code")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("confirm")
            .setDescription("Confirm update")
            .setRequired(true)
            .addChoices(
              { name: "yes", value: "yes" },
              { name: "no", value: "no" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Admin: delete a server code")
        .addStringOption((opt) =>
          opt
            .setName("server")
            .setDescription("Select a server")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("confirm")
            .setDescription("Confirm delete")
            .setRequired(true)
            .addChoices(
              { name: "yes", value: "yes" },
              { name: "no", value: "no" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("rename")
        .setDescription("Admin: rename a server")
        .addStringOption((opt) =>
          opt
            .setName("server")
            .setDescription("Select a server")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("new_name")
            .setDescription("New server name")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("confirm")
            .setDescription("Confirm rename")
            .setRequired(true)
            .addChoices(
              { name: "yes", value: "yes" },
              { name: "no", value: "no" }
            )
        )
    ),

  // This command must NOT be deferred by interactionCreate.js
  noDefer: true,

  async autocomplete(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== "update" && sub !== "delete") return;

    const focused = interaction.options.getFocused();
    const rows = listServerCodes();
    const choices = buildAutocompleteChoices(rows, focused);
    return interaction.respond(choices);
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const member = interaction.member;
    const isAdmin =
      member?.permissions?.has(PermissionFlagsBits.Administrator) ||
      member?.permissions?.has(PermissionFlagsBits.ManageGuild);

    if (subcommand === "add") {
      if (!isAdmin) {
        return interaction.reply({
          content: "⛔ Admins only.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const confirm = interaction.options.getString("confirm", true);
      if (confirm !== "yes") {
        return interaction.reply({
          content: "❎ Add cancelled.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const name = interaction.options.getString("name", true).trim();
      const code = interaction.options.getString("server_code", true).trim();
      const serverKey = normalizeServerKey(name);

      if (!serverKey) {
        return interaction.reply({
          content: "⚠️ Invalid server name.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const existing = getServerCode(serverKey);
      if (existing) {
        return interaction.reply({
          content:
            `⚠️ Server key \`${serverKey}\` already exists. Use /server update instead.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      addServerCode(serverKey, name, code);

      return interaction.reply({
        content:
          `✅ Added ${serverKey}.\n` +
          `Name: \`${name}\`\n` +
          `Code: \`${code}\``,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "update") {
      if (!isAdmin) {
        return interaction.reply({
          content: "⛔ Admins only.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const confirm = interaction.options.getString("confirm", true);
      if (confirm !== "yes") {
        return interaction.reply({
          content: "❎ Update cancelled.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const serverKey = interaction.options.getString("server", true);
      const newCode = interaction.options.getString("server_code", true).trim();
      const existing = getServerCode(serverKey);
      if (!existing) {
        return interaction.reply({
          content: "⚠️ Server not found.",
          flags: MessageFlags.Ephemeral,
        });
      }

      upsertServerCode(serverKey, existing.name || serverKey, newCode);

      return interaction.reply({
        content:
          `✅ Updated ${serverKey}.\n` +
          `Name: \`${existing.name || serverKey}\`\n` +
          `Code: \`${newCode}\``,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "delete") {
      if (!isAdmin) {
        return interaction.reply({
          content: "⛔ Admins only.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const confirm = interaction.options.getString("confirm", true);
      if (confirm !== "yes") {
        return interaction.reply({
          content: "❎ Delete cancelled.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const serverKey = interaction.options.getString("server", true);
      const existing = getServerCode(serverKey);

      if (!existing) {
        return interaction.reply({
          content: "⚠️ Server not found.",
          flags: MessageFlags.Ephemeral,
        });
      }

      deleteServerCode(serverKey);

      return interaction.reply({
        content: `✅ Deleted ${serverKey}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "rename") {
      if (!isAdmin) {
        return interaction.reply({
          content: "⛔ Admins only.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const confirm = interaction.options.getString("confirm", true);
      if (confirm !== "yes") {
        return interaction.reply({
          content: "❎ Rename cancelled.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const serverKey = interaction.options.getString("server", true);
      const newName = interaction.options.getString("new_name", true).trim();
      const existing = getServerCode(serverKey);

      if (!existing) {
        return interaction.reply({
          content: "⚠️ Server not found.",
          flags: MessageFlags.Ephemeral,
        });
      }

      upsertServerCode(serverKey, newName, existing.code);

      return interaction.reply({
        content:
          `✅ Renamed ${serverKey}.\n` +
          `Name: \`${newName}\``,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand !== "list") return;

    const embed = createStyledEmbed(
      "🛰️ UNITED DIVISIONS OF DEFENSE BRM 5 SERVER CODES",
      [
        "**Approved server registry**",
        "Use these codes to join the UDOD Official BRM5 Servers",
      ].join("\n"),
      config.theme.SECONDARY
    );

    const entries = listServerCodes();

    // Two-column layout
    if (entries.length === 0) {
      embed.addFields({
        name: "No server codes configured",
        value: "Use `/server add` to add codes.",
        inline: false,
      });
    } else {
      for (let i = 0; i < entries.length; i += 2) {
        const left = entries[i];
        const right = entries[i + 1];

        embed.addFields(
          {
            name: `🛰️ ${left.name}`,
            value: `\`\`\`\n${left.code}\n\`\`\``,
            inline: true,
          },
          right
            ? {
                name: `🛰️ ${right.name}`,
                value: `\`\`\`\n${right.code}\n\`\`\``,
                inline: true,
              }
            : {
                name: "\u200B",
                value: "\u200B",
                inline: true,
              }
        );

        if (i + 2 < entries.length) {
          embed.addFields({ name: "—", value: " ", inline: false });
        }
      }
    }

    embed.setFooter({
      text: "ORBIT • Blackhawk Rescue Mission 5 Server Registry",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

    // ✅ Reply with embed + optional attached banner file
    return interaction.reply({
      embeds: [embed],
    });
  },
};
