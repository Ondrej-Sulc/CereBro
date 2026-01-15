import { CommandInteraction } from "discord.js";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";
import { championList } from "../../../services/championService";
import Fuse from "fuse.js";

interface TagData {
  category: string;
  name: string;
}

export async function handleChampionUploadTagsCsv(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;
  logger.info(`Starting champion tags CSV upload process for ${interaction.user.tag}`);

  try {
    await interaction.deferReply({ ephemeral: true });

    const attachment = interaction.options.getAttachment("csv", true);
    if (!attachment.contentType?.startsWith("text/csv")) {
      await interaction.editReply("Please upload a valid CSV file.");
      return;
    }

    await interaction.editReply("Processing CSV file...");

    const response = await fetch(attachment.url);
    if (!response.ok) {
      await interaction.editReply(
        `Failed to fetch the file: ${response.statusText}`
      );
      return;
    }
    const csvData = await response.text();

    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) {
      await interaction.editReply("CSV file is empty or missing headers.");
      return;
    }

    // Helper to split CSV line handling quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    // Expected: Champion Name, Category1, Category2, ...
    
    // Map Champion Name -> List of Tags
    const championTagsMap = new Map<string, TagData[]>();

    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      if (row.length === 0) continue;

      const championName = row[0];
      if (!championName) continue;

      if (!championTagsMap.has(championName)) {
        championTagsMap.set(championName, []);
      }

      const tags = championTagsMap.get(championName)!;

      // Iterate over columns
      for (let j = 1; j < row.length; j++) {
        const tagName = row[j];
        const category = headers[j];

        if (tagName && category) {
          tags.push({ name: tagName, category });
        }
      }
    }

    const fuse = new Fuse(championList, { keys: ["name"], threshold: 0.2 });
    let updatedCount = 0;
    let notFoundCount = 0;
    const notFoundNames: string[] = [];

    await interaction.editReply(`Found ${championTagsMap.size} unique champions in CSV. Updating database...`);

    for (const [rawName, tags] of championTagsMap) {
      // 1. Find Champion
      let championId: number | undefined;

      // Try exact match first (case-insensitive)
      const exactMatch = championList.find(c => c.name.toLowerCase() === rawName.toLowerCase());
      if (exactMatch) {
        championId = exactMatch.id;
      } else {
        // Fuzzy match
        const searchResults = fuse.search(rawName);
        if (searchResults.length > 0) {
          championId = searchResults[0].item.id;
        }
      }

      if (!championId) {
        logger.warn(`Champion not found in DB: ${rawName}`);
        notFoundCount++;
        notFoundNames.push(rawName);
        continue;
      }

      // 2. Prepare Tags (Upsert and get IDs)
      const tagIds: number[] = [];
      
      // Use transaction for each champion to ensure consistency
      // But maybe too many transactions? 
      // Upserting tags individually is fine.
      
      for (const tagData of tags) {
        // Check if tag exists or create it
        // We use prisma.tag.upsert
        const tag = await prisma.tag.upsert({
          where: {
            name_category: {
              name: tagData.name,
              category: tagData.category
            }
          },
          update: {},
          create: {
            name: tagData.name,
            category: tagData.category
          }
        });
        tagIds.push(tag.id);
      }

      // 3. Update Champion Links
      await prisma.champion.update({
        where: { id: championId },
        data: {
          tags: {
            set: tagIds.map(id => ({ id }))
          }
        }
      });
      
      updatedCount++;
    }

    let summary = `Successfully updated tags for ${updatedCount} champions.`;
    if (notFoundCount > 0) {
      summary += `\nWarning: ${notFoundCount} champions from CSV were not found in the database.`;
      if (notFoundNames.length <= 5) {
        summary += `\n(${notFoundNames.join(", ")})`;
      } else {
        summary += `\n(${notFoundNames.slice(0, 5).join(", ")} and ${notFoundNames.length - 5} others)`;
      }
    }

    await interaction.editReply(summary);
    logger.info(`Champion tags CSV upload complete. Updated: ${updatedCount}, Not Found: ${notFoundCount}`);

  } catch (error) {
    logger.error(error, "An error occurred during champion tags CSV upload");
    await interaction.editReply(
      `An error occurred: ${ 
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
