import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import { handleGlobalSearch, handleSearchPagination } from "./all";
import { handleRosterSearch, handleRosterSearchPagination } from "./roster";
import { handleAutocomplete } from "./autocomplete";

function addEffectOptions(subcommand: SlashCommandSubcommandBuilder) {
  return subcommand
    .addStringOption(option => option.setName("effect-form").setDescription("Match ability sources with this form")
      .addChoices({ name: "Buff", value: "BUFF" }, { name: "Debuff", value: "DEBUFF" },
        { name: "Passive", value: "PASSIVE" }, { name: "Not recorded", value: "UNKNOWN" }))
    .addStringOption(option => option.setName("effect-direction").setDescription("Match ability sources with this direction")
      .addChoices({ name: "Gains on self", value: "GAIN" }, { name: "Inflicts on opponent", value: "INFLICT" },
        { name: "Not recorded", value: "UNKNOWN" }))
    .addBooleanOption(option => option.setName("include-resistances")
      .setDescription("Include resistances in immunity searches (default: true; false for full immunity only)"))
    .addNumberOption(option => option.setName("min-resistance").setMinValue(0)
      .setDescription("Minimum potency reduction %, including full immunities; excludes unknown or other reductions"));
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Powerful search for champions based on various criteria.")
    .addSubcommand((subcommand) =>
      addEffectOptions(subcommand)
        .setName("all")
        .setDescription("Search from all champions in the game")
        .addStringOption((option) =>
          option
            .setName("abilities")
            .setDescription("Search by abilities (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("immunities")
            .setDescription("Search by immunities and resistances (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("tags")
            .setDescription("Search by tags (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("class")
            .setDescription("Search by class (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("ability-category")
            .setDescription("Search by ability category (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("attack-type")
            .setDescription(
              "Syntax: [all|any] [group] [props...]. e.g. 'all basic energy' or 's1 non-contact'"
            )
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      addEffectOptions(subcommand)
        .setName("roster")
        .setDescription("Search from a player roster")
        .addStringOption((option) =>
          option
            .setName("abilities")
            .setDescription("Search by abilities (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("immunities")
            .setDescription("Search by immunities and resistances (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("tags")
            .setDescription("Search by tags (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("class")
            .setDescription("Search by class (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("ability-category")
            .setDescription("Search by ability category (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("attack-type")
            .setDescription(
              "Syntax: [all|any] [group] [props...]. e.g. 'all basic energy' or 's1 non-contact'"
            )
            .setAutocomplete(true)
        )
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("The player whose roster to search")
            .setRequired(false)
        )
    ),
  access: CommandAccess.PUBLIC,
  help: {
    group: "Information & Search",
    color: "indigo",
    subcommands: {
      all: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/search_crush.png",
      },
      roster: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/search_roster_complex.png",
      },
    },
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    await handleAutocomplete(interaction);
  },
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "all") {
      await handleGlobalSearch(interaction);
    } else if (subcommand === "roster") {
      await handleRosterSearch(interaction);
    }
  },
};

registerButtonHandler("search", handleSearchPagination);
registerButtonHandler("roster_search", handleRosterSearchPagination);

export default command;
