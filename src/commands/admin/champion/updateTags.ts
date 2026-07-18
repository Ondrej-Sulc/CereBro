import { CommandInteraction, MessageFlags } from "discord.js";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";
import { processTags } from "./addChampion";

export async function handleChampionUpdateTags(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion tags update process for ${interaction.user.tag}`
    );

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.editReply("Starting tags update process...");

      const name = interaction.options.getString("name", true);
      const tagsImageUrl = interaction.options.getString("tags_image", true);

      logger.info(`Updating tags for champion: ${name}`);

      const champion = await prisma.champion.findUnique({
        where: { name },
      });

      if (!champion) {
        await interaction.editReply(`Champion **${name}** not found.`);
        logger.warn(`Champion not found for tags update: ${name}`);
        return;
      }

      await interaction.editReply("Processing new tags...");
      logger.info("Processing new tags...");
      const tags = await processTags(tagsImageUrl);
      logger.info("Tag processing complete.");

      await interaction.editReply("Updating tags in database...");
      logger.info("Updating tags in database...");

      await prisma.$transaction(async (tx) => {
        const tagConnections = [];
        for (const category in tags) {
          if (category === "All") continue;
          for (const tagName of tags[category]) {
            const tag = await tx.tag.upsert({
              where: { name_category: { name: tagName, category } },
              update: {},
              create: { name: tagName, category },
            });
            tagConnections.push({ id: tag.id });
          }
        }
        logger.info(`Upserted ${tagConnections.length} tags`);

        await tx.champion.update({
          where: { id: champion.id },
          data: {
            tags: {
              set: tagConnections,
            },
          },
        });
        logger.info(`Connected tags to champion ${champion.name}`);
      });

      await interaction.editReply(`Tags for **${name}** updated successfully!`);
      logger.info(`Champion tags update process complete for ${name}`);
    } catch (error) {
      logger.error(error, "An error occurred during champion tags update");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
}
