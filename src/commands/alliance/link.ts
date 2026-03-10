import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { prisma } from '../../services/prismaService';
import loggerService from '../../services/loggerService';
import { syncRolesForGuild } from './sync-roles';
import { getAlliance } from '../../utils/allianceHelper';

export async function handleAllianceLink(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  const code = interaction.options.getString('code', true).toUpperCase();

  try {
    // 1. Find the web alliance with this code
    const targetAlliance = await prisma.alliance.findFirst({
      where: {
        linkCode: code,
        linkCodeExpires: {
          gt: new Date(),
        },
      },
    });

    if (!targetAlliance) {
      await interaction.editReply('❌ Invalid or expired link code. Please generate a new one on the CereBro website.');
      return;
    }

    // Check if there are empty auto-created alliances in this server that we should clean up
    const emptyAlliances = await prisma.alliance.findMany({
      where: { guildId: interaction.guildId }
    });
    
    for (const empty of emptyAlliances) {
      const memberCount = await prisma.player.count({ where: { allianceId: empty.id } });
      if (memberCount === 0) {
         await prisma.alliance.delete({ where: { id: empty.id } });
      }
    }

    // Direct link to this server
    await prisma.alliance.update({
        where: { id: targetAlliance.id },
        data: { 
            guildId: interaction.guildId,
            linkCode: null,
            linkCodeExpires: null
        }
    });

    // 3. Perform initial role sync
    await syncRolesForGuild(interaction.guild, targetAlliance.id);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Alliance Linked Successfully')
      .setDescription(`The alliance **${targetAlliance.name}** is now linked to this Discord server.\n\nAutomatic role synchronization has been triggered.`) 
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    loggerService.info({
      guildId: interaction.guildId,
      allianceId: targetAlliance.id,
      linkedBy: interaction.user.tag,
    }, `Alliance ${targetAlliance.name} linked to guild`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    loggerService.error({ error: errorMessage, guildId: interaction.guildId }, 'Error linking alliance');
    await interaction.editReply('An error occurred while linking the alliance.');
  }
}
