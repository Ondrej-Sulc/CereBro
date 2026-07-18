import { CommandInteraction, MessageFlags } from "discord.js";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";

export async function handleGlossaryUpdateCategory(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(`Starting glossary update category process for ${interaction.user.tag}`);

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const categoryName = interaction.options.getString("category", true);
        const description = interaction.options.getString("description", true);

        await interaction.editReply(
            `Updating description for category '${categoryName}'...`
        );

        const category = await prisma.abilityCategory.upsert({
            where: { name: categoryName },
            update: { description: description },
            create: { name: categoryName, description: description },
        });

        await interaction.editReply(
            `Successfully updated description for category '${category.name}'.`
        );
        logger.info(
            `Successfully updated description for category ${category.name}`
        );
    } catch (error) {
        logger.error(error, "An error occurred during glossary update category");
        await interaction.editReply(
            `An error occurred: ${
                error instanceof Error ? error.message : "Unknown error"
            }`
        );
    }
}
