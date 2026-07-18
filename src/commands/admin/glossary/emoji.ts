
import { AutocompleteInteraction, ChatInputCommandInteraction, Routes, MessageFlags } from "discord.js";
import { prisma } from "../../../services/prismaService";
import logger from "../../../services/loggerService";
import { createDiscordEmoji } from "../../../utils/emojiHelper";

export async function getAbilityAutocomplete(query: string) {
    const abilities = await prisma.ability.findMany({
        where: {
            name: {
                contains: query,
                mode: "insensitive",
            },
        },
        take: 25,
    });
    return abilities.map((ability) => ({
        name: ability.name,
        value: ability.name,
    }));
}

export async function handleSetEmoji(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const abilityName = interaction.options.getString("ability", true);
    const image = interaction.options.getAttachment("image", true);

    const ability = await prisma.ability.findUnique({
        where: { name: abilityName },
    });

    if (!ability) {
        await interaction.editReply(`Ability **${abilityName}** not found.`);
        return;
    }

    if (ability.emoji) {
        const emojiId = ability.emoji.split(":")[2].replace(">", "");
        try {
            const { client } = interaction;
            const app = await client.application?.fetch();
            if (app?.id) {
                await client.rest.delete(Routes.applicationEmoji(app.id, emojiId));
                logger.info(`Deleted old emoji with id ${emojiId}`);
            }
        } catch (error) {
            logger.error(error, `Failed to delete old emoji with id ${emojiId}`);
        }
    }

    try {
        const newEmoji = await createDiscordEmoji(interaction, ability.name, image.url);
        if (newEmoji) {
            const emojiMarkup = `<:${newEmoji.name}:${newEmoji.id}>`;
            await prisma.ability.update({
                where: { id: ability.id },
                data: { emoji: emojiMarkup },
            });
            await interaction.editReply(`Emoji for **${abilityName}** has been set to ${emojiMarkup}.`);
        } else {
            await interaction.editReply(`Failed to create emoji for **${abilityName}**.`);
        }
    } catch (error) {
        logger.error(error, "Failed to create emoji");
        await interaction.editReply("An error occurred while creating the emoji.");
    }
}

export async function handleRemoveEmoji(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const abilityName = interaction.options.getString("ability", true);

    const ability = await prisma.ability.findUnique({
        where: { name: abilityName },
    });

    if (!ability) {
        await interaction.editReply(`Ability **${abilityName}** not found.`);
        return;
    }

    if (ability.emoji) {
        const emojiId = ability.emoji.split(":")[2].replace(">", "");
        try {
            const { client } = interaction;
            const app = await client.application?.fetch();
            if (app?.id) {
                await client.rest.delete(Routes.applicationEmoji(app.id, emojiId));
                logger.info(`Deleted old emoji with id ${emojiId}`);
            }
        } catch (error) {
            logger.error(error, `Failed to delete old emoji with id ${emojiId}`);
        }

        await prisma.ability.update({
            where: { id: ability.id },
            data: { emoji: null },
        });

        await interaction.editReply(`Emoji for **${abilityName}** has been removed.`);
    } else {
        await interaction.editReply(`**${abilityName}** does not have an emoji set.`);
    }
}
