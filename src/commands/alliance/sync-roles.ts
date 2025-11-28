import { ChatInputCommandInteraction, Guild } from 'discord.js';
import { prisma } from '../../services/prismaService';
import loggerService from '../../services/loggerService';

/**
 * Synchronizes Discord roles for officers and battlegroups with the database for a specific guild.
 * @param guild The guild to sync roles for.
 * @returns The number of players whose roles were updated.
 */
export async function syncRolesForGuild(guild: Guild): Promise<number> {
  const alliance = await prisma.alliance.findUnique({
    where: { guildId: guild.id },
  });

  if (!alliance || (!alliance.officerRole && !alliance.battlegroup1Role && !alliance.battlegroup2Role && !alliance.battlegroup3Role)) {
    loggerService.warn({ guildId: guild.id }, 'Attempted to sync roles for an alliance with no roles configured.');
    return 0;
  }

  const alliancePlayers = await prisma.player.findMany({
    where: { allianceId: alliance.id },
  });

  const members = await guild.members.fetch();
  let updatedPlayers = 0;

  for (const player of alliancePlayers) {
    const member = members.get(player.discordId);
    
    let battlegroup: number | null = null;
    let isOfficer = false;

    if (member) {
      if (alliance.battlegroup1Role && member.roles.cache.has(alliance.battlegroup1Role)) {
        battlegroup = 1;
      } else if (alliance.battlegroup2Role && member.roles.cache.has(alliance.battlegroup2Role)) {
        battlegroup = 2;
      } else if (alliance.battlegroup3Role && member.roles.cache.has(alliance.battlegroup3Role)) {
        battlegroup = 3;
      }

      isOfficer = !!(alliance.officerRole && member.roles.cache.has(alliance.officerRole));
    }

    // Determine if we should remove the player from the alliance
    // Remove if: Not in a BG AND Not an Officer AND Not a Bot Admin
    if (battlegroup === null && !isOfficer && !player.isBotAdmin) {
      await prisma.player.update({
        where: { id: player.id },
        data: { allianceId: null, battlegroup: null, isOfficer: false },
      });
      updatedPlayers++;
    } else {
      // Update roles if changed
      if (player.battlegroup !== battlegroup || player.isOfficer !== isOfficer) {
        await prisma.player.update({
          where: { id: player.id },
          data: { battlegroup, isOfficer },
        });
        updatedPlayers++;
      }
    }
  }
  
  loggerService.info(`Alliance roles synced for guild ${guild.id}. ${updatedPlayers} players updated/removed.`);
  return updatedPlayers;
}


export async function handleAllianceSyncRoles(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  try {
    await interaction.editReply('Starting role synchronization... This may take a moment.');
    const updatedCount = await syncRolesForGuild(interaction.guild);
    await interaction.followUp(`Role synchronization complete. ${updatedCount} player(s) updated.`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    loggerService.error({ error: errorMessage }, 'Error syncing alliance roles');
    await interaction.editReply('An error occurred while syncing alliance roles.');
  }
}
