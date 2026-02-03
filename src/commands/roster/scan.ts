import {
  ChatInputCommandInteraction,
  Message,
  MessageCollector,
  TextChannel,
  MessageFlags,
  Attachment,
} from "discord.js";
import { getPlayer } from "../../utils/playerHelper";
import { processStatsViewScreenshot } from "./ocr/process";
import { RosterUpdateResult } from "./ocr/types";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { handleError } from "../../utils/errorHandler";
import logger from "../../services/loggerService";

const SCAN_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export async function handleScan(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // 1. Authenticate / Get Player
  const player = await getPlayer(interaction);
  if (!player) {
    // getPlayer handles the reply if player is not found
    return;
  }

  // 2. Initial Reply
  await interaction.reply({
    content:
      `**Ready to scan!** 📸\n` +
      `Please upload your **Battlegrounds View** screenshots now.\n` +
      `- You can upload multiple images at once.\n` +
      `- I will listen in this channel for the next **5 minutes**.\n` +
      `- Make sure you are in the "Battlegrounds" view (not "My Champions").`,
  });

  const channel = interaction.channel as TextChannel;
  if (!channel) return;

  logger.info({ userId: player.id }, "Starting roster scan session");

  // 3. Setup Collector
  const collector = channel.createMessageCollector({
    filter: (m: Message) =>
      m.author.id === interaction.user.id && m.attachments.size > 0,
    time: SCAN_DURATION_MS,
  });

  // 4. Handle Collected Messages
  collector.on("collect", async (message: Message) => {
    logger.info({ userId: player.id, msgId: message.id, attachmentCount: message.attachments.size }, "Processing scan message");
    try {
        await processMessage(message, player.id, interaction.client);
    } catch (error) {
        logger.error({ error, msgId: message.id }, "Error processing scan message");
        await message.reply({ content: "❌ An unexpected error occurred while processing this message." });
    }
  });

  // 5. Handle End
  collector.on("end", async (collected, reason) => {
    if (reason === "time") {
      try {
        await interaction.followUp({
          content: `🛑 **Scan session ended.** I am no longer listening for screenshots. Run \\\`/roster scan\\\` again if you have more.`,
          flags: [MessageFlags.Ephemeral],
        });
      } catch (e) {
        // Interaction might be expired or channel deleted
      }
    }
  });
}

async function processMessage(message: Message, playerId: string, client: any) {
  // Acknowledge receipt
  const processingMsg = await message.reply("⏳ Processing images...");

  const images = Array.from(message.attachments.values()).filter(
    (att) => att.contentType?.startsWith("image/")
  );

  if (images.length === 0) {
    await processingMsg.edit("❌ No valid images found in this message.");
    return;
  }

  const results: { success: boolean; error?: string; count: number; added: any[] }[] = [];
  const allAddedChampions: any[] = [];
  const globalErrors: string[] = [];

  // Process all images in parallel
  const promises = images.map(async (image) => {
    try {
      // Note: We pass the URL, processStatsViewScreenshot handles downloading
      // But processStatsViewScreenshot expects Buffer or string URL.
      // Let's pass URL.
      
      const result = await processStatsViewScreenshot(
        image.url,
        false, // debugMode
        playerId
      );

      if ("error" in result && typeof result.error === "string") {
          return { success: false, error: result.error, count: 0, added: [] };
      }
      
      const updateResult = result as RosterUpdateResult;
      // In stats view, champions is [RosterWithChampion[]] (one item which is the array)
      // or simply RosterWithChampion[][]
      const added = updateResult.champions.flat();
      
      // Check for specific errors in the result object if any (the service returns { champions, errors })
      if ((result as any).errors && Array.isArray((result as any).errors)) {
          (result as any).errors.forEach((e: string) => globalErrors.push(`${image.name}: ${e}`));
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

  // Construct Response
  const totalCount = allAddedChampions.length;
  logger.info({ 
      userId: playerId, 
      msgId: message.id, 
      processed: batchResults.length, 
      added: totalCount, 
      errors: globalErrors.length 
  }, "Scan batch complete");

  const resolveEmojis = createEmojiResolver(client);
  
  // Format champion list
  // Grouping by star level for cleaner output? 
  // Or just listing them as they come. The prompt said "pagination/splitting".
  
  let content = `**Scan Complete!**\n` +
                `✅ **${totalCount}** champions updated/added.\n`;

  if (globalErrors.length > 0) {
      content += `⚠️ **${globalErrors.length}** issues found:\n` + 
                 globalErrors.map(e => `- ${e}`).slice(0, 5).join("\n") + 
                 (globalErrors.length > 5 ? `\n...and ${globalErrors.length - 5} more.` : "") + "\n";
  }

  // Generate the visual list
  const champLines = allAddedChampions.map((entry) => {
    const awakened = entry.isAwakened ? "★" : ""; // No empty star, just star if awakened? Or keep existing style.
    // Existing style in update.ts: const awakened = entry.isAwakened ? "★" : "☆";
    const awakenedStr = entry.isAwakened ? "★" : "☆";
    const ascendedStr = entry.isAscended ? "🏆" : "";
    const emoji = entry.champion.discordEmoji || "";
    const sigStr = entry.sigLevel > 0 ? `(s${entry.sigLevel})` : "";
    
    return `${awakenedStr}${emoji}${ascendedStr} ${entry.stars}* R${entry.rank} ${entry.champion.shortName || entry.champion.name} ${sigStr}`;
  });

  const chunks = chunkString(champLines, 1900); // Leave room for header

  // Send first message (edit the processing message)
  if (chunks.length === 0) {
      await processingMsg.edit(content);
  } else {
      await processingMsg.edit(content + "\n" + resolveEmojis(chunks[0]));
      
      // Send remaining chunks as follow-ups
      for (let i = 1; i < chunks.length; i++) {
          await (message.channel as TextChannel).send(resolveEmojis(chunks[i]));
      }
  }
}

function chunkString(lines: string[], maxChars: number): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    for (const line of lines) {
        if ((currentChunk + "\n" + line).length > maxChars) {
            chunks.push(currentChunk);
            currentChunk = line;
        } else {
            currentChunk = currentChunk ? (currentChunk + "\n" + line) : line;
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    return chunks;
}
