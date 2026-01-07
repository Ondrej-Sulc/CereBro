import {
  ButtonInteraction,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SeparatorBuilder,
  AttachmentBuilder,
} from "discord.js";
import { getChampionDataById } from "../../services/championService";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { createChampionActionRow, createPaginationActionRow } from "./actionRow";
import { getAbilitiesContent } from "./abilities";
import { getAttacksContent } from "./attacks";
import { getDuelContent, addDuelComponents } from "./duel";
import { getImmunitiesContent } from "./immunities";
import { getInfoContent } from "./info";
import { getOverviewContent, OverviewSection } from "./overview";
import { getTagsContent } from "./tags";
import { CLASS_COLOR } from "./view";
import { generateChampionThumbnail } from "./thumbnail";
import { getChampionImageUrl } from "../../utils/championHelper";
import { DuelStatus } from "@prisma/client";

export async function handleChampionViewSwitch(interaction: ButtonInteraction) {
  await interaction.deferUpdate();

  const [_, championId, view] = interaction.customId.split(":");

  const champion = await getChampionDataById(parseInt(championId, 10));
  if (!champion) {
    return;
  }

  // Regenerate thumbnail for the new view
  const newThumbnail = await generateChampionThumbnail({
    championName: champion.name.toUpperCase(),
    championClass: champion.class,
    secondaryImageUrl: getChampionImageUrl(champion.images, "full", "secondary"),
    primaryImageUrl: getChampionImageUrl(champion.images, "full", "primary"),
    subcommand: view,
    width: 800,
    height: 300,
  });

  const newThumbnailFileName = `${champion.name
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase()}_${view}_${Date.now()}.png`;
  const newAttachment = new AttachmentBuilder(newThumbnail, {
    name: newThumbnailFileName,
  });

  const resolveEmoji = createEmojiResolver(interaction.client);
  const container = new ContainerBuilder();
  container.setAccentColor(CLASS_COLOR[champion.class]);

  const thumbnailGallery = new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder()
      .setDescription(`**${champion.name}**`)
      .setURL(`attachment://${newThumbnailFileName}`)
  );
  container.addMediaGalleryComponents(thumbnailGallery);

  let content: string | null = null;
  let overviewSections: OverviewSection[] | null = null;
  let paginationRow: ActionRowBuilder<ButtonBuilder> | null = null;

  switch (view) {
    case "overview":
      const result = getOverviewContent(champion, resolveEmoji);
      if (typeof result === "string") {
        content = result;
      } else {
        overviewSections = result;
      }
      break;
    case "abilities":
      content = getAbilitiesContent(champion, resolveEmoji);
      break;
    case "immunities":
      content = getImmunitiesContent(champion, resolveEmoji);
      break;
    case "attacks":
      content = getAttacksContent(champion);
      break;
    case "tags":
      content = getTagsContent(champion);
      break;
    case "info":
      const info = getInfoContent(champion, 1);
      content = info.content;
      if (info.totalPages > 1) {
        paginationRow = createPaginationActionRow(
          champion.id.toString(),
          view,
          info.currentPage,
          info.totalPages
        );
      }
      break;
    case "duel":
      const duelsToShow = champion.duels.filter(
        (d) => d.status === DuelStatus.ACTIVE || d.status === DuelStatus.OUTDATED
      );
      content = getDuelContent(duelsToShow, resolveEmoji);
      break;
    default:
      const defaultResult = getOverviewContent(champion, resolveEmoji);
      if (typeof defaultResult === "string") {
        content = defaultResult;
      } else {
        overviewSections = defaultResult;
      }
      break;
  }

  if (overviewSections) {
    overviewSections.forEach((section, index) => {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${section.title}\n${section.content}`)
      );
      if (index < overviewSections!.length - 1) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }
    });
  } else if (content) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  }

  if (paginationRow) {
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addActionRowComponents(paginationRow);
  }

  if (view === "duel") {
    addDuelComponents(container, champion, resolveEmoji);
  }

  container.addSeparatorComponents(new SeparatorBuilder());
  const viewActionRows = createChampionActionRow(
    champion.id.toString(),
    view
  );
  container.addActionRowComponents(...viewActionRows);


  await interaction.editReply({
    components: [container],
    files: [newAttachment],
    flags: [MessageFlags.IsComponentsV2],
  });
}