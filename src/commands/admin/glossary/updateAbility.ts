import { CommandInteraction, MessageFlags } from "discord.js";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";

export async function handleGlossaryUpdateAbility(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(`Starting glossary update ability process for ${interaction.user.tag}`);

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const abilityName = interaction.options.getString("ability", true);
        const description = interaction.options.getString("description", true);

        await interaction.editReply(
            `Updating description for ability '${abilityName}'...`
        );

        const ability = await prisma.ability.upsert({
            where: { name: abilityName },
            update: { description: description },
            create: { name: abilityName, description: description },
        });

        await interaction.editReply(
            `Successfully updated description for ability '${ability.name}'.`
        );
        logger.info(
            `Successfully updated description for ability ${ability.name}`
        );
    } catch (error) {
        logger.error(error, "An error occurred during glossary update ability");
        await interaction.editReply(
            `An error occurred: ${
                error instanceof Error ? error.message : "Unknown error"
            }`
        );
    }
}
