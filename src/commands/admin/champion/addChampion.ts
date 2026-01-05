import {
  CommandInteraction,
  GuildEmoji,
  Routes,
  ModalSubmitInteraction,
} from "discord.js";
import sharp from "sharp";
import { createDiscordEmoji, downloadImage } from "../../../utils/emojiHelper";
import { gcpStorageService } from "../../../services/gcpStorageService";
import {
  OpenRouterMessage,
  OpenRouterService,
} from "../../../services/openRouterService";
import { ChampionClass } from "@prisma/client";
import logger from "../../../services/loggerService";



export async function processAndUploadImages(
    championName: string,
    primaryUrl: string | null,
    secondaryUrl: string | null,
    heroUrl: string | null
  ) {
    logger.info(`_processAndUploadImages for ${championName}`);
    const formattedName = championName
      .replace(/ /g, "_")
      .replace(/\(|\)|'|\./g, "")
      .toLowerCase();
    const imageUrls: any = {};

    // Process hero image
    if (heroUrl) {
      const heroImgBuffer = await downloadImage(heroUrl);
      const gcsHeroPath = `hero/${formattedName}.png`;
      imageUrls.hero = await gcpStorageService.uploadBuffer(
        heroImgBuffer,
        gcsHeroPath
      );
      logger.info(`Uploaded ${gcsHeroPath}`);
    }

    for (const type of ["primary", "secondary"]) {
      const url = type === "primary" ? primaryUrl : secondaryUrl;
      if (url) {
        const imgBuffer = await downloadImage(url);
        const typePrefix = type.charAt(0);

        const originalSize = 256;
        const gcsOriginalPath = `${originalSize}/${formattedName}_${type}.png`;
        const key = `full_${type}`;
        imageUrls[key] = await gcpStorageService.uploadBuffer(
          await sharp(imgBuffer).resize(originalSize, originalSize).toBuffer(),
          gcsOriginalPath
        );
        logger.info(`Uploaded ${gcsOriginalPath}`);

        const blurredImg = sharp(imgBuffer).blur(0.5);

        for (const size of [128, 64, 32]) {
          const gcsResizedPath = `${size}/${formattedName}_${type}.png`;
          const key = `${typePrefix}_${size}`;
          imageUrls[key] = await gcpStorageService.uploadBuffer(
            await blurredImg.clone().resize(size, size).toBuffer(),
            gcsResizedPath
          );
          logger.info(`Uploaded ${gcsResizedPath}`);
        }
      }
    }

    return imageUrls;
  }

export async function processTags(imageUrl: string): Promise<any> {
    logger.info(`_processTags for ${imageUrl}`);
    const imgBuffer = await downloadImage(imageUrl);
    const metadata = await sharp(imgBuffer).metadata();

    const width = metadata.width || 0;
    const height = metadata.height || 0;

    const croppedImageBuffer = await sharp(imgBuffer)
      .extract({
        left: Math.floor(width * 0.25),
        top: Math.floor(height * 0.1),
        width: Math.floor(width * 0.45),
        height: Math.floor(height * 0.8),
      })
      .toBuffer();

    const base64Image = croppedImageBuffer.toString("base64");

    const system_message: OpenRouterMessage = {
      role: "system",
      content: [
        {
          type: "text",
text: "Extract information from the image and fill in the following JSON structure, keep all the tag groups even if empty, include # with the tag values, omit 'No Tags' and leave an empty list value instead:\n          \"Combat Style\": [\"string\"],\n          \"Attributes\": [\"string\"],\n          \"Organization\": [\"string\"],\n          \"Alliance Wars\": [\"string\"],\n          \"Carina's Challenges\": [\"string\"],\n          \"Alliance Quest\": [\"string\"],\n          \"Release Date\": [\"string\"],\n          \"Saga\": [\"string\"]\n"        },
      ],
    };

    const user_message: OpenRouterMessage = {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Image}`,
          },
        },
      ],
    };

    logger.info("Sending image to OpenRouter for tag extraction...");
    const { config } = await import("../../../config.js");
    const openRouterService = new OpenRouterService(config.OPEN_ROUTER_API_KEY!);
    const response = await openRouterService.chat({
      model: "google/gemini-2.5-flash",
      messages: [system_message, user_message],
      response_format: { type: "json_object" },
    });

    const tags = JSON.parse(response.choices[0].message.content);
    logger.info({ tags }, "Received tags from OpenRouter");
    const allTags = Object.values(tags).flat();
    tags["All"] = [...new Set(allTags)].sort();

    return tags;
}



export async function saveChampionToDb(
    name: string,
    shortName: string,
    champClass: ChampionClass,
    releaseDate: string,
    obtainableRange: string,
    imageUrls: any,
    tags: any,
    emoji: any | undefined
  ) {
    logger.info(`_saveChampionToDb for ${name}`);
    const [start, end] = obtainableRange.split("-").map(Number);
    const obtainable = Array.from({ length: end - start + 1 }, (_, i) =>
      (start + i).toString()
    );

    const discordEmoji = emoji ? `<:${emoji.name}:${emoji.id}>` : undefined;

    const championData = {
      name,
      shortName,
      class: champClass,
      releaseDate: new Date(releaseDate),
      obtainable,
      images: imageUrls,
      discordEmoji,
      fullAbilities: {},
    };

    const { prisma } = await import("../../../services/prismaService.js");
    await prisma.$transaction(async (tx) => {
      const champion = await tx.champion.upsert({
        where: { name },
        update: championData,
        create: championData,
      });
      logger.info(`Upserted champion ${champion.name} with id ${champion.id}`);

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
}

export async function addChampion(
    interaction: CommandInteraction | ModalSubmitInteraction,
    championData: any
  ) {
    logger.info(`Starting champion add process for ${interaction.user.tag}`);

    try {
      await interaction.editReply("Starting champion creation process...");

      const {
        name,
        shortName,
        champClass,
        tagsImageUrl,
        primaryImageUrl,
        secondaryImageUrl,
        heroImageUrl,
        releaseDate,
        obtainableRange,
      } = championData;

      logger.info(`Adding champion: ${name}`);

      // 1. Process and upload images
      await interaction.editReply("Processing and uploading images...");
      logger.info("Processing and uploading images...");
      const imageUrls = await processAndUploadImages(
        name,
        primaryImageUrl,
        secondaryImageUrl,
        heroImageUrl
      );
      logger.info("Image processing complete.");

      // 2. Process tags
      await interaction.editReply("Processing tags...");
      logger.info("Processing tags...");
      const tags = await processTags(tagsImageUrl);
      logger.info("Tag processing complete.");

      // 3. Create Discord Emoji
      await interaction.editReply("Creating Discord emoji...");
      logger.info("Creating Discord emoji...");
      const emoji = await createDiscordEmoji(
        interaction,
        shortName,
        imageUrls.p_128
      );
      logger.info(`Emoji created: ${emoji?.name}`);

      // 4. Save to Database
      await interaction.editReply("Saving champion to database...");
      logger.info("Saving champion to database...");
      await saveChampionToDb(
        name,
        shortName,
        champClass,
        releaseDate,
        obtainableRange,
        imageUrls,
        tags,
        emoji
      );
      logger.info("Champion saved to database.");

      await interaction.editReply(
        `Champion **${name}** created or updated successfully!`
      );
      logger.info(`Champion add process complete for ${name}`);
    } catch (error) {
      logger.error(error, "An error occurred during champion creation");
      await interaction.editReply(
        `An error occurred: ${ 
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
