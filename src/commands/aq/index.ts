import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ChannelType,
  AutocompleteInteraction,
  GuildBasedChannel,
  PermissionsBitField,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { handleStart } from "./start";
import { handleEnd } from "./end";
import { handleAqSchedule } from "./schedule/index";

import "./handlers";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("aq")
    .setDescription("Alliance Quest utilities")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a new AQ tracker manually in a channel")
        .addIntegerOption((o) =>
          o
            .setName("day")
            .setDescription("Current AQ day (1-4)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(4)
        )
        .addIntegerOption((o) =>
          o
            .setName("battlegroup")
            .setDescription("Select the battlegroup for the player list")
            .setRequired(true)
            .addChoices(
              { name: 'Battlegroup 1', value: 1 },
              { name: 'Battlegroup 2', value: 2 },
              { name: 'Battlegroup 3', value: 3 }
            )
        )
        .addRoleOption((o) =>
          o
            .setName("ping-role")
            .setDescription("Optional: A specific role to ping for notifications.")
            .setRequired(false)
        )
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Target channel (defaults to current)")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End the active AQ tracker in a channel")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Channel to end (defaults to current)")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("schedule")
        .setDescription("Manage the automated AQ schedule.")
    ),
  access: CommandAccess.USER,
  help: {
    group: "Alliance Tools",
    color: "sky",
    subcommands: {
      start: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/aq_start.png",
      },
      schedule: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/aq_schedule_overview.png",
      },
    },
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    // This is no longer used by /aq start, but may be used by other commands in the future.
    const focused = interaction.options.getFocused(true);

    if (focused.name !== "role") return;

    const guild = interaction.guild;
    if (!guild) {
      await interaction.respond([]);
      return;
    }

    const query = String(focused.value || "").toLowerCase();

    // Fetch roles from the guild to ensure we have fresh data
    const rolesCollection = await guild.roles.fetch();

    const filteredRoles = rolesCollection
      .filter(
        (r) =>
          !r.managed &&
          r.name !== "@everyone" &&
          r.name.toLowerCase().includes(query)
      )
      .first(25);

    await interaction.respond(
      filteredRoles.map((r) => ({ name: r.name, value: r.id }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand(true);

    if (subcommand === "schedule") {
      const member = interaction.member;
      if (
        !member ||
        typeof member.permissions === "string" ||
        !member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        await interaction.reply({
          content: "You must be an administrator to use this command.",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }
    }

    if (subcommand === "schedule") {
      await handleAqSchedule(interaction);
      return;
    }

    const sub = interaction.options.getSubcommand();
    if (sub === "start") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const day = interaction.options.getInteger("day", true);
      const battlegroup = interaction.options.getInteger("battlegroup", true);
      const pingRole = interaction.options.getRole("ping-role");
      const targetChannel = (interaction.options.getChannel("channel") ||
        interaction.channel) as GuildBasedChannel | null;
      if (!targetChannel) {
        await interaction.editReply("Please choose a valid channel.");
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply(
          "This command can only be used in a guild."
        );
        return;
      }

      const result = await handleStart({
        day,
        battlegroup,
        pingRoleId: pingRole?.id || null,
        channel: targetChannel,
        guild,
        channelName: targetChannel.name,
        battlegroupName: `Battlegroup ${battlegroup}`,
        userId: interaction.user.id,
      });
      await interaction.editReply(result);
    } else if (sub === "end") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const targetChannel = (interaction.options.getChannel("channel") ||
        interaction.channel) as GuildBasedChannel | null;
      if (!targetChannel) {
        await interaction.editReply("Channel not found.");
        return;
      }

      const result = await handleEnd({
        channel: targetChannel,
        user: interaction.user,
      });
      await interaction.editReply(result);
    }
  },
};

export default command;
