import { recordPlayerPrestige } from "../../services/playerPrestigeService";
import {
  MessageFlags,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  AttachmentBuilder,
} from "discord.js";
import { CommandResult } from "../../types/command";
import { Player } from "@prisma/client";
import { extractPrestigeFromImage } from "./ocr";

export async function updatePrestige(params: {
  userId: string;
  imageUrl: string;
  targetUserId?: string;
  debug?: boolean;
  player: Player;
}): Promise<CommandResult> {
  const { prisma } = await import("../../services/prismaService.js");
  const { imageUrl, debug, player } = params;

  const res = await fetch(imageUrl);
  if (!res.ok) {
    return {
      content: `❌ **Error:** Failed to download image. Status: ${res.status}`,
    };
  }
  const imageBuffer = Buffer.from(await res.arrayBuffer());

  const result = await extractPrestigeFromImage(imageBuffer, debug);

  if (debug) {
    const attachments: AttachmentBuilder[] = [];
    const container = new ContainerBuilder();
    container.setAccentColor(result.success ? 0x57f287 : 0xed4245);

    if (result.debugInfo?.croppedImage) {
      const attachmentName = "cropped_debug.png";
      attachments.push(
        new AttachmentBuilder(result.debugInfo.croppedImage, {
          name: attachmentName,
        })
      );
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(`attachment://${attachmentName}`)
        )
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
    }

    let debugContent = `## Prestige OCR Debug Info\n`;
    debugContent += `**Success:** ${result.success}\n`;
    debugContent += `**Fallback Used:** ${result.fallback ?? false}\n`;
    if (result.error) {
      debugContent += `**Error:** ${result.error}\n`;
    }
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(debugContent)
    );

    const addAttemptFields = (attempt: any, name: string) => {
      if (!attempt) return;

      let attemptContent = `### ${name}\n`;
      if (attempt.error) {
        attemptContent += `**Error:** ${attempt.error}\n`;
      }
      if (attempt.detectedLabels) {
        attemptContent += `**Detected Values:**\n> Summoner: ${attempt.detectedLabels.summoner}\n> Champion: ${attempt.detectedLabels.champion}\n> Relic: ${attempt.detectedLabels.relic}\n`;
      }
      if (attempt.extracted?.labels?.length) {
        const labelsStr = attempt.extracted.labels
          .map((l: any) => `> ${l.text}`)
          .join("\n");
        attemptContent += 
          `**Extracted Labels:**\n${labelsStr.substring(0, 1020)}\n`;
      }
      if (attempt.extracted?.numbers?.length) {
        const numbersStr = attempt.extracted.numbers
          .map((n: any) => `> ${n.value}`)
          .join("\n");
        attemptContent += 
          `**Extracted Numbers:**\n${numbersStr.substring(0, 1020)}\n`;
      }
      if (attempt.text) {
        attemptContent += `**OCR Text:**\n\
\`\`\`\n${attempt.text.substring(
          0,
          1000
        )}\n\
\`\`\`\n\n`;
      }
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(attemptContent)
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
    };

    addAttemptFields(result.debugInfo?.cropAttempt, "Crop Attempt");
    addAttemptFields(result.debugInfo?.fullAttempt, "Full Image Attempt");

    return {
      components: [container],
      files: attachments,
      flags: MessageFlags.IsComponentsV2,
    };
  }

  const { success, summonerPrestige, championPrestige, relicPrestige } = result;

  const finalSummonerPrestige = summonerPrestige ?? 0;
  const finalChampionPrestige = championPrestige ?? 0;
  const finalRelicPrestige = relicPrestige ?? 0;

  const isValid =
    success && finalSummonerPrestige === finalChampionPrestige + finalRelicPrestige;

  if (isValid) {
    const oldPrestige = player.summonerPrestige;

    const saved = await recordPlayerPrestige(prisma, player.id, {
      relicPrestige: finalRelicPrestige,
      championPrestige: finalChampionPrestige,
    });

    const prestigeChange =
      oldPrestige && oldPrestige > 0 ? (saved.summonerPrestige ?? 0) - oldPrestige : 0;
    const changeString =
      prestigeChange > 0
        ? `(+${prestigeChange})`
        : prestigeChange < 0
        ? `(${prestigeChange})`
        : "";

    const prestigeInfo =
      `**Prestige Values for ${player.ingameName}**:\n` +
      `🏆 TOP 30 Prestige: **${saved.summonerPrestige}** ${changeString}\n` +
      `⚔️ Champion Prestige: **${saved.championPrestige}**\n` +
      `🔮 Relic Prestige: **${saved.relicPrestige}**\n` +
      `\n*Prestige has been updated for ${player.ingameName}. ${saved.relicPrestigeFromInventory
        ? "Relic prestige is calculated automatically from your top 30 saved relics."
        : "Relic prestige uses the imported value until your collection has 30 relics with available ratings."}*`;

    const container = new ContainerBuilder();
    container.setAccentColor(0xffd700); // Gold color for prestige
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(imageUrl)
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(prestigeInfo)
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
  } else {
    const container = new ContainerBuilder();
    container.setAccentColor(0xed4245); // Red

    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(imageUrl)
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    const errorMessage =
      "❌ **Could not validate prestige from the image.**\n\n" +
      "For best results, please try one of the following:\n" +
      "1. Use a clear, unedited screenshot from your profile.\n" +
      "2. Crop the screenshot to *only* the area with the three prestige numbers.";

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(errorMessage)
    );

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    };
  }
}
