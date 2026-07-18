import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { handleScheduleAdd } from "./add";
import { handleScheduleList } from "./list";
import { handleScheduleRemove } from "./remove";
import { handleScheduleAutocomplete } from "./autocomplete";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Manage scheduled tasks")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a new scheduled task for a command or message")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription(
              "Label for this schedule (e.g., 'Morning Reminder')"
            )
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("frequency")
            .setDescription("Frequency: daily, weekly, monthly, every")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Time(s), e.g. 09:00 or 09:00,18:00")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("command")
            .setDescription(
              "Command to run (e.g., /today, /exercise pullup). Leave empty if using 'message'."
            )
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription(
              "Custom message to send (optional, overrides command if provided)"
            )
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("target_channel_id")
            .setDescription("Target channel ID (optional)")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("target_user_id")
            .setDescription("Target user ID (optional)")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("day")
            .setDescription(
              "Day of week (for weekly) or day of month (for monthly)"
            )
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("interval")
            .setDescription("Interval for 'every' frequency, e.g. 2")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("unit")
            .setDescription("Unit for 'every' frequency: days, weeks")
            .setRequired(false)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all active scheduled tasks")
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a scheduled task by its ID or list number")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID of the schedule to remove (see /schedule list)")
            .setRequired(false)
        )
        .addIntegerOption((option) =>
          option
            .setName("number")
            .setDescription(
              "List number of the schedule to remove (see /schedule list)"
            )
            .setRequired(false)
        )
    ),
  access: CommandAccess.PUBLIC,
  help: {
    group: "Utilities",
    color: "emerald",
  },
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand(true);
    switch (subcommand) {
      case "add":
        await handleScheduleAdd(interaction);
        break;
      case "list":
        await handleScheduleList(interaction);
        break;
      case "remove":
        await handleScheduleRemove(interaction);
        break;
    }
  },
  
  autocomplete: handleScheduleAutocomplete,
};
