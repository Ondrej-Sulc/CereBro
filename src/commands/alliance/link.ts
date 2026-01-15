import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { prisma } from '../../services/prismaService';
import loggerService from '../../services/loggerService';
import { syncRolesForGuild } from './sync-roles';

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

    // 2. Check if this server already has an alliance record
    const existingServerAlliance = await prisma.alliance.findUnique({
      where: { guildId: interaction.guildId },
    });

    if (existingServerAlliance && existingServerAlliance.id !== targetAlliance.id) {
      // MERGE LOGIC:
      // If the existing server alliance has no members other than auto-created ones, 
      // or if it was just auto-created by the bot joining, we can "swap" the guildId.
      
      const memberCount = await prisma.player.count({
          where: { allianceId: existingServerAlliance.id }
      });

      // If it's a "fresh" server alliance (less than 2 members), we merge.
      // Otherwise, we ask for manual cleanup to prevent data loss.
      if (memberCount > 1) {
          await interaction.editReply('❌ This server is already linked to another alliance with active members. Please contact support if you need to merge alliances.');
          return;
      }

      // Safe to "delete" the old server record and move guildId to the new one
      await prisma.$transaction([
          prisma.alliance.update({
              where: { id: existingServerAlliance.id },
              data: { guildId: null } // Free up the guildId
          }),
          prisma.alliance.delete({
              where: { id: existingServerAlliance.id }
          }),
          prisma.alliance.update({
              where: { id: targetAlliance.id },
              data: { 
                  guildId: interaction.guildId,
                  linkCode: null,
                  linkCodeExpires: null
              }
          })
      ]);
    } else {
        // Direct link
        await prisma.alliance.update({
            where: { id: targetAlliance.id },
            data: { 
                guildId: interaction.guildId,
                linkCode: null,
                linkCodeExpires: null
            }
        });
    }

    // 3. Perform initial role sync
    await syncRolesForGuild(interaction.guild);

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
