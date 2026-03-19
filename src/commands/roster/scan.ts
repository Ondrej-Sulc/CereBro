import {
  ChatInputCommandInteraction,
  Message,
  MessageCollector,
  TextChannel,
  MessageFlags,
  Attachment,
  ContainerBuilder,
  TextDisplayBuilder,
  Client,
} from "discord.js";
import { getActivePlayer, getPlayer, isAuthorizedToManage } from "../../utils/playerHelper";
import { processBGViewScreenshot } from "./ocr/process";
import { RosterUpdateResult, RosterWithChampion } from "./ocr/types";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { handleError } from "../../utils/errorHandler";
import { config } from "../../config";
import logger from "../../services/loggerService";

const SCAN_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const MAX_LIST_DISPLAY_CHAMPS = 40;

const activeScans = new Set<string>();

export async function handleScan(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const userId = interaction.user.id;

  // 1. Defer immediately to prevent timeout (3s window)
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  if (activeScans.has(userId)) {
    await interaction.editReply({
      content:
        `❌ **You already have an active scan session.**\n` +
        `Please finish that session or wait for it to expire (5 minutes).`,
    });
    return;
  }

  activeScans.add(userId);

  try {
    // 2. Get Players
    const callerPlayer = await getActivePlayer(userId);
    const targetPlayer = await getPlayer(interaction);
    
    if (!targetPlayer) {
      activeScans.delete(userId);
      return;
    }

    if (!callerPlayer) {
      await interaction.editReply({
        content: "❌ Your profile not found. Please register first.",
      });
      activeScans.delete(userId);
      return;
    }

    // 3. Authorization check
    if (!isAuthorizedToManage(callerPlayer, targetPlayer)) {
      await interaction.editReply({
        content: `❌ You are not authorized to update **${targetPlayer.ingameName}**'s roster. Only the player themselves, bot admins, or alliance officers can do this.`,
      });
      activeScans.delete(userId);
      return;
    }

    // 4. Initial Reply via editReply
    const isSelf = callerPlayer.id === targetPlayer.id;
    const targetName = isSelf ? "your" : `**${targetPlayer.ingameName}**'s`;

    await interaction.editReply({
      content:
        `**Ready to scan ${targetName} roster!** 📸\n` +
        `Please upload **BG View** (Battlegrounds) screenshots now.\n` +
        `- You can upload multiple images at once.\n` +
        `- I will listen in this channel for the next **5 minutes**.\n` +
        `- Make sure you are in the "Battlegrounds" view (not "My Champions").`,
    });

    const channel = interaction.channel as TextChannel;
    if (!channel) {
      activeScans.delete(userId);
      await interaction.editReply({ content: "❌ Could not access this channel." });
      return;
    }

    logger.info({ userId: targetPlayer.id, callerId: callerPlayer.id }, "Starting roster scan session");

    // 5. Setup Collector
    const collector = channel.createMessageCollector({
      filter: (m: Message) =>
        m.author.id === interaction.user.id && m.attachments.size > 0,
      time: SCAN_DURATION_MS,
    });

    // 6. Handle Collected Messages
    collector.on("collect", async (message: Message) => {
      logger.info(
        {
          userId: targetPlayer.id,
          callerId: callerPlayer.id,
          msgId: message.id,
          attachmentCount: message.attachments.size,
        },
        "Processing scan message"
      );
      try {
        await processMessage(message, targetPlayer.id, interaction.client);
      } catch (error) {
        logger.error({ error, msgId: message.id }, "Error processing scan message");
        await message.reply({
          content: "❌ An unexpected error occurred while processing this message.",
        });
      }
    });

    // 7. Handle End - No timeout message
    collector.on("end", async (collected, reason) => {
      activeScans.delete(userId);
      logger.info({ userId: targetPlayer.id, reason }, "Roster scan session ended");
    });
  } catch (error) {
    activeScans.delete(userId);
    throw error;
  }
}

async function processMessage(message: Message, playerId: string, client: Client) {
  // Acknowledge receipt
  const processingMsg = await message.reply("⏳ Processing images...");
  const resolveEmojis = createEmojiResolver(client);

  const images = Array.from(message.attachments.values()).filter(
    (att) => att.contentType?.startsWith("image/")
  );

  if (images.length === 0) {
    await processingMsg.edit("❌ No valid images found in this message.");
    return;
  }

  const allAddedChampions: RosterWithChampion[] = [];
  const globalErrors: string[] = [];

  // Process all images in parallel
  const promises = images.map(async (image) => {
    try {
      const result = await processBGViewScreenshot(
        image.url,
        false, // debugMode
        playerId
      );

      if ("error" in result && typeof result.error === "string") {
          return { success: false, error: result.error, count: 0, added: [] };
      }
      
      const updateResult = result as RosterUpdateResult;
      const added = updateResult.champions.flat();
      
      if (updateResult.errors && Array.isArray(updateResult.errors)) {
          updateResult.errors.forEach((e: string) => globalErrors.push(`${image.name}: ${e}`));
      }

      return { success: true, count: updateResult.count, added };

    } catch (err) {
      const { userMessage } = handleError(err, {
        location: "roster scan",
        userId: message.author.id,
        extra: { image: image.name, playerId },
      });
      return { success: false, error: `Error processing ${image.name}: ${userMessage}`, count: 0, added: [] };
    }
  });

  const batchResults = await Promise.all(promises);

  batchResults.forEach((res) => {
    if (res.success) {
      allAddedChampions.push(...res.added);
    } else if (res.error) {
      globalErrors.push(res.error);
    }
  });

  const totalCount = allAddedChampions.length;
  logger.info({ 
      userId: playerId, 
      msgId: message.id, 
      processed: batchResults.length, 
      added: totalCount, 
      errors: globalErrors.length 
  }, "Scan batch complete");

  // --- Build Response with Container V2 ---
  const container = new ContainerBuilder();

  // 1. Summary Header
  let summaryText = `### Scan Complete! 📸\n` +
                    `✅ **${totalCount}** champions updated/added.`;
  
  if (globalErrors.length > 0) {
      summaryText += `\n⚠️ **${globalErrors.length}** issues found.`;
  }

  // Grouping Logic
  if (totalCount > 0) {
      const groups = new Map<string, number>();
      allAddedChampions.forEach(c => {
          const key = `${c.stars}★ R${c.rank}`;
          groups.set(key, (groups.get(key) || 0) + 1);
      });
      
      const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));
      summaryText += `\n\n**Summary:**\n` + sortedKeys.map(k => `- **${k}**: ${groups.get(k)}`).join("\n");
  }

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(resolveEmojis(summaryText)));

  // 2. Detailed List or Link
  if (totalCount > MAX_LIST_DISPLAY_CHAMPS) {
       const linkText = `\n**List is too long to display!**\n` + 
                        `[View your full roster on the web](${config.botBaseUrl}/profile/roster)`;
       container.addTextDisplayComponents(new TextDisplayBuilder().setContent(linkText));
  } else if (totalCount > 0) {
      const champLines = allAddedChampions.map((entry) => {
        const awakenedStr = entry.isAwakened ? "★" : "☆";
        const ascendedStr = entry.isAscended ? "🏆" : "";
        const emoji = entry.champion.discordEmoji || "";
        const sigStr = entry.sigLevel > 0 ? `(s${entry.sigLevel})` : "";
        return `${awakenedStr}${emoji}${ascendedStr} ${entry.stars}* R${entry.rank} ${entry.champion.shortName || entry.champion.name} ${sigStr}`;
      });

      // Split into chunks if needed (TextDisplay has limits, but here we can add multiple displays)
      const chunks = chunkLines(champLines, 20); // 20 lines per block
      
      for (const chunk of chunks) {
          container.addTextDisplayComponents(new TextDisplayBuilder().setContent(resolveEmojis(chunk)));
      }
  }

  // 3. Errors (if any)
  if (globalErrors.length > 0) {
      const errorText = `**Errors:**\n` + 
                 globalErrors.map(e => `- ${e}`).slice(0, 5).join("\n") + 
                 (globalErrors.length > 5 ? `\n...and ${globalErrors.length - 5} more.` : "");
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(errorText));
  }

  // Send the Container
  try {
      await processingMsg.delete();
  } catch {}

  await message.reply({
      components: [container],
      flags: [MessageFlags.IsComponentsV2]
  });
}

function chunkLines(lines: string[], chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < lines.length; i += chunkSize) {
        chunks.push(lines.slice(i, i + chunkSize).join("\n"));
    }
    return chunks;
}
