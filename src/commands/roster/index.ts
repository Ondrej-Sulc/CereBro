import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { handleUpdate } from "./update";
import { handleScan } from "./scan";
import { handleView } from "./view";
import { handleDelete } from "./delete";
import { handleSummary } from "./summary";
import { handleExport } from "./export";
import { getActivePlayer } from "../../utils/playerHelper";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("roster")
    .setDescription("Manage your MCOC roster.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("scan")
        .setDescription("Auto-scan Battlegrounds View screenshots (interactive mode).")
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription(
              "The player to update the roster for (defaults to you)."
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Update your roster from one or more screenshots.")
        .addIntegerOption((option) =>
          option
            .setName("stars")
            .setDescription(
              "The star level of the champions in the screenshot."
            )
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(7)
        )
        .addIntegerOption((option) =>
          option
            .setName("rank")
            .setDescription("The rank of the champions in the screenshot.")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(5)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image1")
            .setDescription("A screenshot of your champion roster.")
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName("is_ascended")
            .setDescription("Whether the champions are ascended.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image2")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image3")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image4")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image5")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription(
              "The player to update the roster for (defaults to you)."
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View a player's roster.")
        .addIntegerOption((option) =>
          option
            .setName("stars")
            .setDescription("Filter by star level.")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(7)
        )
        .addIntegerOption((option) =>
          option
            .setName("rank")
            .setDescription("Filter by rank.")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(5)
        )
        .addBooleanOption((option) =>
          option
            .setName("is_ascended")
            .setDescription("Filter by ascended status.")
            .setRequired(false)
        )
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription(
              "The player whose roster to view (defaults to you)."
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete a player's roster, or parts of it.")
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription(
              "The player whose roster to delete (defaults to you)."
            )
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The champion to delete.")
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("stars")
            .setDescription("Filter by star level.")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(7)
        )
        .addIntegerOption((option) =>
          option
            .setName("rank")
            .setDescription("Filter by rank.")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(5)
        )
        .addBooleanOption((option) =>
          option
            .setName("is_ascended")
            .setDescription("Filter by ascended status.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("summary")
        .setDescription("Display a summary of a player's roster.")
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription(
              "The player whose roster to summarize (defaults to you)."
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("export")
        .setDescription("Export a player's roster to a CSV file.")
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription(
              "The player whose roster to export (defaults to you)."
            )
            .setRequired(false)
        )
    ),
  access: CommandAccess.USER,
  help: {
    group: "User Management",
    color: "pink",
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    const { prisma } = await import("../../services/prismaService.js");
    const focusedValue = interaction.options.getFocused();
    const player = await getActivePlayer(interaction.user.id);

    if (!player) {
      await interaction.respond([]);
      return;
    }

    const roster = await prisma.roster.findMany({
      where: {
        playerId: player.id,
        champion: {
          name: {
            contains: focusedValue,
            mode: "insensitive",
          },
        },
      },
      include: { champion: true },
      take: 25,
    });

    await interaction.respond(
      roster.map((entry: { champion: { name: string }; stars: number; rank: number; championId: number }) => ({
        name: `${entry.champion.name} ${entry.stars}* R${entry.rank}`,
        value: entry.championId.toString(),
      }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "scan") {
      await handleScan(interaction);
    } else if (subcommand === "update") {
      await handleUpdate(interaction);
    } else if (subcommand === "view") {
      await handleView(interaction);
    } else if (subcommand === "delete") {
      await handleDelete(interaction);
    } else if (subcommand === "summary") {
      await handleSummary(interaction);
    } else if (subcommand === "export") {
      await handleExport(interaction);
    }
  },
};