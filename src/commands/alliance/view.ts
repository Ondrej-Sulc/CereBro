import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { prisma } from '../../services/prismaService';
import loggerService from '../../services/loggerService';
import { Player } from '@prisma/client';

const OFFICER_ICON = '🛡️';

function formatPlayerList(players: Player[]): string {
  if (players.length === 0) {
    return 'No players in this battlegroup.';
  }
  return players
    .map(p => `${p.isOfficer ? `${OFFICER_ICON} ` : ''}${p.ingameName} (<@${p.discordId}>)`)
    .join('\n');
}

export async function handleAllianceView(interaction: ChatInputCommandInteraction) {
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

    // Check if roles are configured
    if (!alliance.officerRole && !alliance.battlegroup1Role && !alliance.battlegroup2Role && !alliance.battlegroup3Role) {
      const setupEmbed = new EmbedBuilder()
        .setColor(0xFFCC00) // Yellow
        .setTitle('Alliance Roles Not Configured')
        .setDescription('To see the full alliance overview with battlegroups, an administrator needs to configure the officer and battlegroup roles first.')
        .addFields({ name: 'Command to run:', value: '`/alliance config-roles`' });
      await interaction.editReply({ embeds: [setupEmbed] });
      return;
    }

    const bg1Players = alliance.members.filter(p => p.battlegroup === 1);
    const bg2Players = alliance.members.filter(p => p.battlegroup === 2);
    const bg3Players = alliance.members.filter(p => p.battlegroup === 3);
    const unassignedPlayers = alliance.members.filter(p => p.battlegroup === null);

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`Alliance Overview: ${alliance.name}`)
      .addFields(
        { name: '--- Battlegroup 1 ---', value: formatPlayerList(bg1Players), inline: false },
        { name: '--- Battlegroup 2 ---', value: formatPlayerList(bg2Players), inline: false },
        { name: '--- Battlegroup 3 ---', value: formatPlayerList(bg3Players), inline: false },
      )
      .setTimestamp();

    if (unassignedPlayers.length > 0) {
      embed.addFields({ name: '--- Unassigned ---', value: formatPlayerList(unassignedPlayers), inline: false });
    }
    
    if (alliance.members.length === 0) {
        embed.setDescription('There are no players registered in this alliance yet.');
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    loggerService.error({ error: errorMessage, guildId: interaction.guildId }, 'Error fetching alliance view');
    await interaction.editReply('An error occurred while fetching the alliance overview.');
  }
}