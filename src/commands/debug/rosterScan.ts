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
import { processBGViewScreenshot } from "../roster/ocr/process";
import { RosterDebugResult } from "../roster/ocr/types";
import { createEmojiResolver } from "../../utils/emojiResolver";

export async function handleRosterScanDebug(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const image = interaction.options.getAttachment("image", true);

  await interaction.editReply(`Processing ${image.name}...`);
  const resolveEmojis = createEmojiResolver(interaction.client);

  try {
      const result = (await processBGViewScreenshot(
        image.url,
        true // debugMode
      )) as RosterDebugResult;

      const files: AttachmentBuilder[] = [];
      const container = new ContainerBuilder();

      const title = new TextDisplayBuilder().setContent(
        `### Debug Result for ${image.name} (BG View):`
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
            .setDescription("Debug Image with Grid")
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

  } catch (error) {
      await interaction.followUp({
          content: `Error processing image: ${error instanceof Error ? error.message : String(error)}`,
          flags: [MessageFlags.Ephemeral]
      });
  }
}
