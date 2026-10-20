import {
  ButtonInteraction,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  AttachmentBuilder,
} from "discord.js";
import { getChampionDataById } from "../../services/championService";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { createChampionActionRow } from "./actionRow";
import { addChampionViewContent } from "./content";
import { CLASS_COLOR } from "./view";
import { generateChampionThumbnail } from "./thumbnail";
import { getChampionImageUrl } from "../../utils/championHelper";

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

  addChampionViewContent(container, champion, view, resolveEmoji);

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