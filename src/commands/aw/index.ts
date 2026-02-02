import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { handlePlan } from "./plan.js";
import { handleDetails } from "./details.js";
import { handleSearchSubcommand, handleSearchAutocomplete } from "./search.js";
import { handleUploadSubcommand } from "./upload.js";

import { handleDefensePlan } from "./defensePlan";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("aw")
    .setDescription("Commands for Alliance War planning and details.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("plan")
        .setDescription("Sends AW plan details from sheet to player threads.")
        .addIntegerOption((option) =>
          option
            .setName("battlegroup")
            .setDescription("The battlegroup to send the plan for.")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(3)
        )
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("A specific player to send the plan to.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image")
            .setDescription("An image to send along with the plan.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
        subcommand
          .setName("defense-plan")
          .setDescription("Sends defense plan layout to battlegroup channels.")
          .addIntegerOption((option) =>
            option
              .setName("battlegroup")
              .setDescription("Optional: Specific battlegroup to send to.")
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(3)
          )
      )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("details")
        .setDescription("Get detailed information about your AW assignments.")
        .addStringOption((option) =>
          option
            .setName("node")
            .setDescription("A specific node to get details for.")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('upload')
        .setDescription('Generates a link to upload a new Alliance War video.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Search for war fights and videos.')
        .addStringOption(option => 
            option.setName('attacker')
            .setDescription('Attacker Champion name')
            .setAutocomplete(true))
        .addStringOption(option => 
            option.setName('defender')
            .setDescription('Defender Champion name')
            .setAutocomplete(true))
        .addStringOption(option => 
            option.setName('player')
            .setDescription('Player in-game name')
            .setAutocomplete(true))
        .addIntegerOption(option => 
            option.setName('node')
            .setDescription('Node number')
            .setAutocomplete(true))
        .addIntegerOption(option => option.setName('tier').setDescription('War Tier').setAutocomplete(true))
        .addIntegerOption(option => option.setName('season').setDescription('War Season').setAutocomplete(true))
        .addBooleanOption(option => option.setName('has_video').setDescription('Filter for fights with video'))
    ),
  access: CommandAccess.PUBLIC,
  help: {
    group: "Alliance Tools",
    color: "sky",
  },
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "plan":
        await handlePlan(interaction);
        break;
      case "defense-plan":
        await handleDefensePlan(interaction);
        break;
      case "details":
        await handleDetails(interaction);
        break;
      case "upload":
        await handleUploadSubcommand(interaction);
        break;
      case "search":
        await handleSearchSubcommand(interaction);
        break;
    }
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'search') {
        await handleSearchAutocomplete(interaction);
    }
  }
};