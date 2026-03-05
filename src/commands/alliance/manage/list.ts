import { ChatInputCommandInteraction } from 'discord.js';
import loggerService from '../../../services/loggerService';

export async function handleAllianceManageList(interaction: ChatInputCommandInteraction) {
  const { prisma } = await import('../../../services/prismaService.js');
  if (!interaction.guildId) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  try {
    const alliance = await prisma.alliance.findFirst({
      where: { guildId: interaction.guildId },
      include: {
        members: {
          orderBy: {
            ingameName: 'asc',
          },
        },
      },
    });

    if (!alliance) {
      await interaction.editReply('This server is not registered as an alliance.');
      return;
    }

    if (alliance.members.length === 0) {
      await interaction.editReply('There are no players registered in this alliance.');
      return;
    }

    const header = `Alliance Roster for ${alliance.name} (${alliance.members.length} members):\n\n`;
    const playerLines = alliance.members.map(p => 
      `- ${p.ingameName} (<@${p.discordId}>) | Officer: ${p.isOfficer ? 'Yes' : 'No'} | BG: ${p.battlegroup || 'N/A'}`
    );

    const fullMessage = header + playerLines.join('\n');

    if (fullMessage.length <= 2000) {
      await interaction.editReply(fullMessage);
    } else {
      // Handle long messages by splitting them
      await interaction.editReply(header);
      let currentMessage = '';
      for (const line of playerLines) {
        if (currentMessage.length + line.length + 1 > 1990) { // Leave some buffer
          await interaction.followUp('```' + currentMessage + '```');
          currentMessage = '';
        }
        currentMessage += line + '\n';
      }
      if (currentMessage) {
        await interaction.followUp('```' + currentMessage + '```');
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    loggerService.error({ error: errorMessage, guildId: interaction.guildId }, 'Error listing alliance members');
    await interaction.editReply('An error occurred while listing alliance members.');
  }
}