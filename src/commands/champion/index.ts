import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ContainerBuilder,
  SeparatorBuilder,
} from "discord.js";
import { getChampionData, championList } from "../../services/championService";
import { Command, CommandAccess } from "../../types/command";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { generateChampionThumbnail } from "./thumbnail";
import { getChampionImageUrl } from "../../utils/championHelper";
import { createChampionActionRow } from "./actionRow";
import { addChampionViewContent } from "./content";
import { CLASS_COLOR } from "./view";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import { registerModalHandler } from "../../utils/modalHandlerRegistry";
import { registerSelectMenuHandler } from "../../utils/selectMenuHandlerRegistry";
import {
  handleDuelReportButton,
  handleDuelReportSelect,
  handleDuelSuggestButton,
  handleDuelSuggestModalSubmit,
} from "./duelUserHandlers";

// Duel-related handlers
registerButtonHandler("champion-duel-suggest_", handleDuelSuggestButton);
registerButtonHandler("champion-duel-report_", handleDuelReportButton);
registerModalHandler("champion-duel-suggest-modal_", handleDuelSuggestModalSubmit);
registerSelectMenuHandler("champion-duel-report-select_", (interaction) => {
    if (interaction.isStringSelectMenu()) {
        return handleDuelReportSelect(interaction);
    }
    return Promise.resolve();
});

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("champion")
    .setDescription("Get information about a specific champion.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Display a champion's core details and full abilities.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("attacks")
        .setDescription("Display a champion's attack types and properties.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("abilities")
        .setDescription("List all of a champion's abilities.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("immunities")
        .setDescription("List all of a champion's immunities.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("tags")
        .setDescription("List all of a champion's tags.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("overview")
        .setDescription("Display a champion's abilities, immunities, and tags.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("duel")
        .setDescription("Get duel targets for a champion.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  access: CommandAccess.PUBLIC,
  help: {
    group: "Information & Search",
    color: "indigo",
    subcommands: {
      abilities: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/champion_abilities_shangchi.png",
      },
      immunities: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/champion_immunities_absorbingman.png",
      },
      attacks: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/champion_attacks_cassandra.png",
      },
      tags: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/champion_tags_nicominoru.png",
      },
      duel: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/champion_duel_darkphoenix.png",
      },
      info: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/champion_info_wintersoldier.png",
      },
      overview: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/champion_overview_hulk.png",
      },
    },
  },
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const filtered = championList.filter((champion) =>
      champion.name.toLowerCase().includes(focusedValue)
    );

    // Slice to get the top 25 results
    const results = filtered.slice(0, 25);

    await interaction.respond(
      results.map((champion) => ({
        name: champion.name,
        value: champion.name,
      }))
    );
  },
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: [] });

    const subcommand = interaction.options.getSubcommand();
    const championName = interaction.options.getString("champion");

    if (!championName) {
      await interaction.editReply({
        content: "You must provide a champion name.",
      });
      return;
    }

    const champion = await getChampionData(championName);

    if (!champion) {
      await interaction.editReply({
        content: `Champion "${championName}" not found.`,
      });
      return;
    }

    const thumbnail = await generateChampionThumbnail({
      championName: champion.name.toUpperCase(),
      championClass: champion.class,
      secondaryImageUrl: getChampionImageUrl(
        champion.images,
        "full",
        "secondary"
      ),
      primaryImageUrl: getChampionImageUrl(champion.images, "full", "primary"),
      subcommand: subcommand,
      width: 800,
      height: 300,
    });

    const cacheBust = Date.now();
    const thumbnailFileName = `${champion.name
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase()}_thumbnail_${cacheBust}.png`;
    const attachment = new AttachmentBuilder(thumbnail, {
      name: thumbnailFileName,
      description: `Thumbnail for ${champion.name}`,
    });

    const container = new ContainerBuilder();
    container.setAccentColor(CLASS_COLOR[champion.class]);

    const thumbnailGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setDescription(`**${champion.name}**`)
        .setURL(`attachment://${thumbnailFileName}`)
    );
    container.addMediaGalleryComponents(thumbnailGallery);

    const resolveEmoji = createEmojiResolver(interaction.client);
    addChampionViewContent(container, champion, subcommand, resolveEmoji);

    container.addSeparatorComponents(new SeparatorBuilder());
    const viewActionRows = createChampionActionRow(
      champion.id.toString(),
      subcommand
    );
    container.addActionRowComponents(...viewActionRows);


    await interaction.editReply({
      components: [container],
      files: [attachment],
      flags: [MessageFlags.IsComponentsV2],
    });
  },
};

export default command;
