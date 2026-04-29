
import { CommandInteraction, GuildEmoji, Routes, ModalSubmitInteraction } from "discord.js";
import logger from "../services/loggerService";

export async function downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(
            `Failed to download image from ${url}: ${response.statusText}`
        );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

export async function createDiscordEmoji(
    interaction: CommandInteraction | ModalSubmitInteraction,
    name: string,
    imageUrl: string
): Promise<any | undefined> {
    logger.info(`_createDiscordEmoji for ${name}`);
    const { client } = interaction;
    const app = await client.application?.fetch();
    if (!app?.id) {
        logger.warn("Could not fetch application id for emoji creation");
        return;
    }

    const cleanName = name.replace(/[^a-zA-Z0-9]/g, "");
    let emojiName = cleanName.substring(0, 3).toLowerCase();

    const emojisResponse = (await client.rest.get(
        Routes.applicationEmojis(app.id)
    )) as any;

    const existingEmojis: any[] = Array.isArray(emojisResponse)
        ? emojisResponse
        : Array.isArray(emojisResponse?.items)
            ? emojisResponse.items
            : Array.isArray(emojisResponse?.emojis)
                ? emojisResponse.emojis
                : [];

    const existingEmojiNames = new Set(existingEmojis.map((e) => e.name));

    let i = 1;
    while (existingEmojiNames.has(emojiName)) {
        if (cleanName.length >= 3) {
            emojiName = `${cleanName.substring(0, 2)}${cleanName.charAt(
                i % cleanName.length
            )}`.toLowerCase();
        } else {
            emojiName = `${cleanName}${i}`.toLowerCase();
        }
        i++;
        if (i > 100) {
            // safety break
            logger.error(
                "Could not generate a unique emoji name after 100 attempts"
            );
            throw new Error("Could not generate a unique emoji name.");
        }
    }
    logger.info(`Generated unique emoji name: ${emojiName}`);

    const imageBuffer = await downloadImage(imageUrl);
    const base64Image = imageBuffer.toString("base64");

    const emoji = await client.rest.post(Routes.applicationEmojis(app.id), {
        body: {
            name: emojiName,
            image: `data:image/png;base64,${base64Image}`,
        },
    });
    logger.info({ emoji }, "Created new application emoji");

    return emoji;
}

export function stripEmojis(text: string): string {
    return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Emoji_Modifier_Base}\p{Emoji_Component}\p{Emoji}]/gu, '').trim();
}
