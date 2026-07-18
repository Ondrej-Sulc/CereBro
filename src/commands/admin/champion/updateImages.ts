import { CommandInteraction, Routes, MessageFlags } from "discord.js";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";
import { getChampionImageUrl } from "../../../utils/championHelper";
import { processAndUploadImages } from "./addChampion";
import { createDiscordEmoji } from "../../../utils/emojiHelper";

export async function handleChampionUpdateImages(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion image update process for ${interaction.user.tag}`
    );

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.editReply("Starting image update process...");

      const name = interaction.options.getString("name", true);
      const primaryImageUrl = interaction.options.getString("primary_image");
      const secondaryImageUrl =
        interaction.options.getString("secondary_image");
      const heroImageUrl = interaction.options.getString("hero_image");

      logger.info(`Updating images for champion: ${name}`);

      const champion = await prisma.champion.findUnique({
        where: { name },
      });

      if (!champion) {
        await interaction.editReply(`Champion **${name}** not found.`);
        logger.warn(`Champion not found for image update: ${name}`);
        return;
      }

      const images = champion.images as any;
      const existingPrimary = getChampionImageUrl(images, "full", "primary");
      const existingSecondary = getChampionImageUrl(
        images,
        "full",
        "secondary"
      );

      await interaction.editReply("Processing and uploading new images...");
      logger.info("Processing and uploading new images...");
      const imageUrls = await processAndUploadImages(
        name,
        primaryImageUrl || existingPrimary,
        secondaryImageUrl || existingSecondary,
        heroImageUrl
      );
      logger.info("Image processing complete.");

      const newImages = { ...images, ...imageUrls };
      let newEmoji = null;

      if (primaryImageUrl) {
        logger.info("Primary image updated, starting emoji update process...");
        const { client } = interaction;
        const app = await client.application?.fetch();
        if (app?.id) {
          if (champion.discordEmoji) {
            const emojiId = champion.discordEmoji
              .split(":")[2]
              .replace(">", "");
            try {
              await client.rest.delete(
                Routes.applicationEmoji(app.id, emojiId)
              );
              logger.info(`Deleted old emoji with id ${emojiId}`);
            } catch (error) {
              logger.error(
                error,
                `Failed to delete old emoji with id ${emojiId}`
              );
              // Continue even if deletion fails, maybe it was already deleted
            }
          }
          newEmoji = await createDiscordEmoji(
            interaction,
            champion.shortName,
            imageUrls.p_128
          );
          logger.info(`Created new emoji: ${newEmoji?.name}`);
        } else {
          logger.warn("Could not fetch application id for emoji update");
        }
      }

      const updateData: any = { images: newImages };
      if (newEmoji) {
        updateData.discordEmoji = `<:${newEmoji.name}:${newEmoji.id}>`;
      }

      await prisma.champion.update({
        where: { id: champion.id },
        data: updateData,
      });
      logger.info("Champion images and emoji updated in database.");

      await interaction.editReply(
        `Images for **${name}** updated successfully!`
      );
      logger.info(`Champion image update process complete for ${name}`);
    } catch (error) {
      logger.error(error, "An error occurred during champion image update");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
}
