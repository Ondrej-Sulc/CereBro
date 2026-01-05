import { CommandInteraction } from "discord.js";
import logger from "../../../services/loggerService";
import { getChampionImageUrl } from "../../../utils/championHelper";

export async function handleChampionSyncSheet(interaction: CommandInteraction) {
    const { prisma } = await import("../../../services/prismaService.js");
    const { sheetsService } = await import("../../../services/sheetsService.js");
    const { config } = await import("../../../config.js");
    if (!interaction.isChatInputCommand()) return;
    logger.info(`Starting sheet sync process for ${interaction.user.tag}`);

    try {
      await interaction.deferReply({ ephemeral: true });
      await interaction.editReply("Starting sheet sync process...");

      logger.info("Fetching all champions from database...");
      const champions = await prisma.champion.findMany({
        include: {
          tags: true,
        },
      });
      logger.info(`Found ${champions.length} champions.`);

      champions.sort((a, b) => a.name.localeCompare(b.name));

      await interaction.editReply("Formatting data for Google Sheet...");
      logger.info("Formatting data for Google Sheet...");

      const headerRow = [
        "Champion Name",
        "Short Name",
        "Class",
        "All Tags",
        "AW Tags",
        "Release Date",
        "Obtainable",
        "Primary 32",
        "Primary 64",
        "Primary 128",
        "Primary 256",
        "Secondary 32",
        "Secondary 64",
        "Secondary 128",
        "Secondary 256",
        "Discord Emoji",
      ];

      const rows = champions.map((champion) => {
        const capitalize = (s: string) =>
          s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

        return [
          champion.name,
          champion.shortName,
          capitalize(champion.class),
          champion.tags.map((tag) => tag.name).join(", "),
          champion.tags
            .filter((tag) => tag.category === "Alliance Wars")
            .map((tag) => tag.name)
            .join(", "),
          champion.releaseDate.toISOString().split("T")[0],
          champion.obtainable.join(", "),
          getChampionImageUrl(champion.images, "32", "primary") || "",
          getChampionImageUrl(champion.images, "64", "primary") || "",
          getChampionImageUrl(champion.images, "128", "primary") || "",
          getChampionImageUrl(champion.images, "full", "primary") || "",
          getChampionImageUrl(champion.images, "32", "secondary") || "",
          getChampionImageUrl(champion.images, "64", "secondary") || "",
          getChampionImageUrl(champion.images, "128", "secondary") || "",
          getChampionImageUrl(champion.images, "full", "secondary") || "",
          champion.discordEmoji || "",
        ];
      });

      const values = [headerRow, ...rows];

      await interaction.editReply("Writing data to Google Sheet...");
      logger.info(
        `Writing ${values.length} rows to spreadsheet ${config.CHAMPION_SHEET_ID}`
      );

      await sheetsService.clearSheet(
        config.CHAMPION_SHEET_ID,
        config.championSheet.clearRange
      );
      await sheetsService.writeSheet(
        config.CHAMPION_SHEET_ID,
        config.championSheet.range,
        values
      );

      logger.info("Sheet sync process complete.");
      await interaction.editReply(
        `Sheet sync complete. ${champions.length} champions written to spreadsheet.`
      );
    } catch (error) {
      logger.error(error, "An error occurred during sheet sync");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
}
