import {
  ChatInputCommandInteraction,
  Attachment,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} from "discord.js";
import { getActivePlayer, getPlayer, isAuthorizedToManage } from "../../utils/playerHelper";
import { processRosterScreenshot } from "./ocr/process";
import { RosterUpdateResult, RosterWithChampion } from "./ocr/types";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { handleError } from "../../utils/errorHandler";
import { recordRosterUploadEvent } from "../../services/rosterUploadTrackingService";

export async function handleUpdate(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();
  const stars = interaction.options.getInteger("stars", true);
  const rank = interaction.options.getInteger("rank", true);
  let isAscended = interaction.options.getBoolean("is_ascended") ?? false;
  let ascensionLevel = interaction.options.getInteger("ascension_level") ?? 0;
  
  // Implicitly set isAscended if an ascension level is provided
  if (ascensionLevel > 0) {
      isAscended = true;
  }
  // Implicitly default to level 1 if only isAscended is true (legacy fallback)
  if (isAscended && ascensionLevel === 0) {
      ascensionLevel = 1;
  }

  const callerPlayer = await getActivePlayer(interaction.user.id);
  if (!callerPlayer) {
    await interaction.editReply("❌ Your profile not found. Please register first.");
    return;
  }

  const targetPlayer = await getPlayer(interaction);
  if (!targetPlayer) {
    // getPlayer already notifies via safeReply (which handles interaction.editReply)
    return;
  }

  if (!isAuthorizedToManage(callerPlayer, targetPlayer)) {
    await interaction.editReply(`❌ You are not authorized to update **${targetPlayer.ingameName}**'s roster. Only the player themselves, bot admins, or alliance officers can do this.`);
    return;
  }

  const player = targetPlayer;

  const images: Attachment[] = [];
  for (let i = 1; i <= 5; i++) {
    const image = interaction.options.getAttachment(`image${i}`);
    if (image) {
      images.push(image);
    }
  }

  if (images.length === 0) {
    await interaction.editReply("You must provide at least one image.");
    return;
  }

  const startTime = Date.now();
  let allAddedChampions: RosterWithChampion[][] = [];
  const errorMessages: string[] = [];

  const promises = images.map((image) =>
    processRosterScreenshot(
      image.url,
      stars,
      rank,
      isAscended,
      ascensionLevel,
      false,
      player.id
    ).catch((error) => {
      const { userMessage } = handleError(error, {
        location: "roster update",
        userId: interaction.user.id,
        extra: {
          image: image.name,
          stars,
          rank,
          isAscended,
          playerId: player.id,
        },
      });
      return { error: `Error processing ${image.name}: ${userMessage}` };
    })
  );

  const results = await Promise.all(promises);

  let successCount = 0;
  results.forEach((result) => {
    if (result) {
      if ("error" in result && typeof result.error === "string") {
        errorMessages.push(result.error);
      } else {
        successCount++;
        allAddedChampions.push(...(result as RosterUpdateResult).champions);
      }
    }
  });

  const totalCount = allAddedChampions.flat().length;
  await recordRosterUploadEvent({
    source: "discord",
    mode: "grid-view",
    actorPlayerId: callerPlayer.id,
    targetPlayerId: player.id,
    actorBotUserId: callerPlayer.botUserId,
    allianceId: player.allianceId,
    discordUserId: interaction.user.id,
    fileCount: images.length,
    visionRequestCount: images.length,
    processedChampionCount: totalCount,
    successCount,
    errorCount: errorMessages.length,
    durationMs: Date.now() - startTime,
    errorMessages,
    metadata: {
      interactionId: interaction.id,
      channelId: interaction.channelId,
      targetChanged: callerPlayer.id !== player.id,
      stars,
      rank,
      isAscended,
      ascensionLevel,
    },
  });

  const container = new ContainerBuilder();

  const galleryItems = images.map((image) =>
    new MediaGalleryItemBuilder()
      .setURL(image.url)
      .setDescription(image.name || "source image")
  );
  const imageGallery = new MediaGalleryBuilder().addItems(...galleryItems);
  container.addMediaGalleryComponents(imageGallery);

  const title = new TextDisplayBuilder().setContent(
    `### Roster update for ${player.ingameName} complete. (${stars}* R${rank})`
  );
  container.addTextDisplayComponents(title);

  const summary = new TextDisplayBuilder().setContent(
    `Total champions added/updated: ${totalCount}`
  );
  container.addTextDisplayComponents(summary);

  const containers: ContainerBuilder[] = [container];
  let currentContainer = container;
  let componentCount = 3; // gallery, title, summary

  function addTextDisplay(content: string) {
    if (componentCount >= 5) {
      currentContainer = new ContainerBuilder();
      containers.push(currentContainer);
      componentCount = 0;
    }
    currentContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(content)
    );
    componentCount++;
  }

  const resolveEmojis = createEmojiResolver(interaction.client);
  let currentChunk = "";

  for (const row of allAddedChampions) {
    const rowContent = row
      .map((entry) => {
        const awakened = entry.isAwakened ? "★" : "☆";
        const ascended = entry.isAscended ? "🏆" : "";
        const emoji = entry.champion.discordEmoji || "";
        return `${awakened}${emoji}${ascended}`;
      })
      .join(" ");

    const formattedRow = `## ${rowContent}\n`;
    const resolvedRow = resolveEmojis(formattedRow);

    if (currentChunk.length + resolvedRow.length > 4000) {
      if (currentChunk) {
        addTextDisplay(currentChunk);
      }
      currentChunk = resolvedRow;
    } else {
      currentChunk += resolvedRow;
    }
  }

  if (currentChunk) {
    addTextDisplay(currentChunk);
  }

  if (errorMessages.length > 0) {
    let currentErrorChunk = "**Errors:**\n";
    for (const error of errorMessages) {
      const formattedError = `${error}\n`;
      if (currentErrorChunk.length + formattedError.length > 4000) {
        addTextDisplay(currentErrorChunk);
        currentErrorChunk = formattedError;
      } else {
        currentErrorChunk += formattedError;
      }
    }
    if (currentErrorChunk) {
      addTextDisplay(currentErrorChunk);
    }
  }

  await interaction.editReply({
    components: containers,
    flags: [MessageFlags.IsComponentsV2],
  });
}
