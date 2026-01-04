import { MessageReaction, User, PartialMessageReaction, PartialUser, Message, Events, EmbedBuilder } from "discord.js";
import { config } from "../config";
import { OpenRouterService, OpenRouterRequest, OpenRouterMessage } from "./openRouterService";
import logger from "./loggerService";

// Map of flag emojis to target languages
const FLAG_TO_LANGUAGE: Record<string, string> = {
  "🇺🇸": "English",
  "🇬🇧": "English",
  "🇦🇺": "English",
  "🇨🇦": "English",
  "🇪🇸": "Spanish",
  "🇲🇽": "Spanish",
  "🇦🇷": "Spanish",
  "🇨🇴": "Spanish",
  "🇫🇷": "French",
  "🇩🇪": "German",
  "🇮🇹": "Italian",
  "🇵🇹": "Portuguese",
  "🇧🇷": "Portuguese",
  "🇷🇺": "Russian",
  "🇯🇵": "Japanese",
  "🇰🇷": "Korean",
  "🇨🇳": "Chinese (Simplified)",
  "🇹🇼": "Chinese (Traditional)",
  "🇭🇰": "Chinese (Traditional)",
  "🇳🇱": "Dutch",
  "🇧🇪": "Dutch",
  "🇵🇱": "Polish",
  "🇹🇷": "Turkish",
  "🇮🇩": "Indonesian",
  "🇻🇳": "Vietnamese",
  "🇹🇭": "Thai",
  "🇸🇦": "Arabic",
  "🇦🇪": "Arabic",
  "🇮🇳": "Hindi",
  "🇺🇦": "Ukrainian",
  "🇨🇿": "Czech",
  "🇸🇰": "Slovak",
  "🇬🇷": "Greek",
  "🇷🇴": "Romanian",
  "🇭🇺": "Hungarian",
  "🇸🇪": "Swedish",
  "🇩🇰": "Danish",
  "🇳🇴": "Norwegian",
  "🇫🇮": "Finnish",
  "🇮🇱": "Hebrew",
  "🇵🇭": "Tagalog",
  "🇲🇾": "Malay",
  "🇸🇬": "Malay",
  "🇮🇷": "Persian",
  "🇵🇰": "Urdu",
  "🇿🇦": "Afrikaans",
  "🇮🇪": "Irish",
};

export async function handleTranslationReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) {
  // 1. Basic checks
  if (user.bot) return; // Ignore bot reactions
  
  // check emoji name (it might be null for custom emojis, but flags are unicode)
  const emoji = reaction.emoji.name;
  if (!emoji || !FLAG_TO_LANGUAGE[emoji]) {
    return; // Not a supported flag
  }

  const targetLanguage = FLAG_TO_LANGUAGE[emoji];

  try {
    // 2. Fetch full structure if partial
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        logger.error({ error: String(error) }, "Something went wrong when fetching the message reaction: ");
        return;
      }
    }
    if (reaction.message.partial) {
        try {
            await reaction.message.fetch();
        } catch (error) {
            logger.error({ error: String(error) }, "Something went wrong when fetching the message: ");
            return;
        }
    }

    const message = reaction.message as Message;
    
    // Ignore if message has no content to translate (e.g. only image, though OCR is an idea for later)
    if (!message.content) return;

    // 3. Get Context (is it a reply?)
    let contextMessageContent = "";
    if (message.reference && message.reference.messageId) {
        try {
            const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (referencedMessage && referencedMessage.content) {
                contextMessageContent = referencedMessage.content;
            }
        } catch (e) {
            // Ignore if can't fetch reference
             logger.warn({ error: String(e) }, "Could not fetch referenced message for translation context.");
        }
    }

    // 4. Perform Translation
    logger.info(`Translating message ${message.id} to ${targetLanguage} for ${user.tag}`);
    const translatedText = await translateText(message.content, targetLanguage, contextMessageContent);

    // 5. Get Display Names
    const authorName = message.member?.displayName || message.author.displayName || message.author.username;
    
    let requesterName = user.username;
    if (message.guild && user.id) {
        try {
            const member = await message.guild.members.fetch(user.id);
            requesterName = member.displayName;
        } catch (e) {
            // Fallback to user properties if fetch fails
            requesterName = (user as User).displayName || user.username || "Unknown";
        }
    }

    // 6. Send Result
    const embed = new EmbedBuilder()
      .setColor(0x0ea5e9) // CereBro Blue
      .setAuthor({
        name: authorName,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(`**Translation (${targetLanguage})**\n${translatedText}\n\n[Jump to Original Message](${message.url})`)
      .setFooter({
        text: `Requested by ${requesterName}`,
        iconURL: user.displayAvatarURL() || undefined,
      })
      .setTimestamp();

    if (message.channel.isSendable()) {
        await message.channel.send({ embeds: [embed] });
    }

  } catch (error) {
    logger.error({ error: String(error) }, "Error in handleTranslationReaction:");
  }
}

async function translateText(text: string, targetLanguage: string, context: string = ""): Promise<string> {
    const openRouterService = new OpenRouterService(config.OPEN_ROUTER_API_KEY!);

    const systemPrompt = `You are a helpful translator bot for a Discord server dedicated to the mobile game "Marvel Contest of Champions" (MCOC). 
Translate the user's message into ${targetLanguage}.
- Keep game-specific terminology accurate (e.g., "Parry", "Dex", "Alliance War", "Alliance Quest") if it makes sense in the target language, or keep it in English if that's the community standard.
- Detect the source language automatically.
- Output ONLY the translation. Do not add introductory text like "Here is the translation:".
${context ? `
Context: The message being translated is a reply to this message: "${context}". Use this context to resolve ambiguities.` : ""}`;

    const messages: OpenRouterMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
    ];

    const request: OpenRouterRequest = {
        model: config.OPENROUTER_DEFAULT_MODEL || "liquid/lfm-40b", // Fallback or use config
        messages: messages,
        temperature: 0.3, // Lower temperature for more accurate translation
    };

    try {
        const response = await openRouterService.chat(request);
        if (response.choices && response.choices.length > 0) {
            return response.choices[0].message.content.trim();
        }
        throw new Error("No choices returned from AI");
    } catch (e) {
        logger.error({ error: String(e) }, "Translation AI request failed");
        return "Sorry, I couldn't translate that message right now.";
    }
}
