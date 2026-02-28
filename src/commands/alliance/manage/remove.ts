import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import loggerService from '../../../services/loggerService';
import { checkAndCleanupAlliance } from '../../../services/allianceService.js';

export async function handleAllianceManageRemove(interaction: ChatInputCommandInteraction) {
  const { prisma } = await import('../../../services/prismaService.js');
  const userToRemove = interaction.options.getUser('user', true);

  if (!interaction.guildId) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  try {
    const player = await prisma.player.findFirst({
      where: {
        discordId: userToRemove.id,
        alliance: {
          guildId: interaction.guildId,
        },
      },
    });

    if (!player) {
      await interaction.editReply({ content: `The user <@${userToRemove.id}> is not registered in this alliance.` });
      return;
    }

    const allianceId = player.allianceId;

    await prisma.player.update({
      where: { id: player.id },
      data: {
        allianceId: null,
        isOfficer: false,
        battlegroup: null,
      },
    });

    // Cleanup empty alliance
    await checkAndCleanupAlliance(allianceId);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Player Removed')
      .setDescription(`Successfully removed <@${userToRemove.id}> (${player.ingameName}) from the alliance.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    loggerService.info({
      guildId: interaction.guildId,
      admin: interaction.user.tag,
      removedUser: userToRemove.tag,
    }, `Player ${userToRemove.tag} removed from alliance`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    loggerService.error({ error: errorMessage, guildId: interaction.guildId }, 'Error removing player from alliance');
    await interaction.editReply('An error occurred while removing the player.');
  }
}