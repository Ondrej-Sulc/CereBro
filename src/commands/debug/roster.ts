import {
  ChatInputCommandInteraction,
  Attachment,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} from "discord.js";
import { processRosterScreenshot } from "../roster/ocr/process";
import { RosterDebugResult } from "../roster/ocr/types";
import { createEmojiResolver } from "../../utils/emojiResolver";

export async function handleRosterDebug(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const images: Attachment[] = [];
  for (let i = 1; i <= 10; i++) {
    const image = interaction.options.getAttachment(`image${i}`);
    if (image) {
      images.push(image);
    }
  }

  if (images.length === 0) {
    await interaction.editReply("You must provide at least one image.");
    return;
  }

  await interaction.editReply(`Processing ${images.length} image(s)...`);
  const resolveEmojis = createEmojiResolver(interaction.client);

  for (const image of images) {
    // Stars and rank are not needed for debug mode, but the function requires them.
    // Pass dummy values.
    const stars = 0;
    const rank = 0;
    const result = (await processRosterScreenshot(
      image.url,
      stars,
      rank,
      false,
      0,
      true
    )) as RosterDebugResult;

    const files: AttachmentBuilder[] = [];
    const container = new ContainerBuilder();

    const title = new TextDisplayBuilder().setContent(
      `### Result for ${image.name}:`
    );
    container.addTextDisplayComponents(title);

    if (result.debugImageBuffer) {
      const attachmentName = `debug_${image.name}`;
      files.push(
        new AttachmentBuilder(result.debugImageBuffer, { name: attachmentName })
      );
      const gallery = new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(`attachment://${attachmentName}`)
          .setDescription("Debug Image")
      );
      container.addMediaGalleryComponents(gallery);
    }

    const content = new TextDisplayBuilder().setContent(
      resolveEmojis(result.message)
    );
    container.addTextDisplayComponents(content);

    await interaction.followUp({
      components: [container],
      files,
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  }
}
