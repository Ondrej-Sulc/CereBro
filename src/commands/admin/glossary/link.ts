import { CommandInteraction, MessageFlags } from "discord.js";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";

export async function handleGlossaryLink(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(`Starting glossary link process for ${interaction.user.tag}`);

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const abilityName = interaction.options.getString("ability", true);
        const categoryName = interaction.options.getString("category", true);

        await interaction.editReply(
            `Linking ability '${abilityName}' to category '${categoryName}'...`
        );

        const ability = await prisma.ability.findUnique({
            where: { name: abilityName },
        });

        if (!ability) {
            await interaction.editReply(`Ability **${abilityName}** not found.`);
            return;
        }

        const category = await prisma.abilityCategory.findUnique({
            where: { name: categoryName },
        });

        if (!category) {
            await interaction.editReply(`Category **${categoryName}** not found.`);
            return;
        }

        await prisma.ability.update({
            where: { id: ability.id },
            data: {
                categories: {
                    connect: { id: category.id },
                },
            },
        });

        await interaction.editReply(
            `Successfully linked ability '${abilityName}' to category '${categoryName}'.`
        );
        logger.info(
            `Successfully linked ability ${abilityName} to category ${categoryName}`
        );
    } catch (error) {
        logger.error(error, "An error occurred during glossary link");
        await interaction.editReply(
            `An error occurred: ${
                error instanceof Error ? error.message : "Unknown error"
            }`
        );
    }
}
