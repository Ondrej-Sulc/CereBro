import { ChatInputCommandInteraction, Guild } from 'discord.js';
import { prisma } from '../../services/prismaService';
import loggerService from '../../services/loggerService';

/**
 * Synchronizes Discord roles for officers and battlegroups with the database for a specific guild.
 * @param guild The guild to sync roles for.
 * @returns An object containing the count of updated and created players.
 */
export async function syncRolesForGuild(guild: Guild): Promise<{ updated: number; created: number }> {
  const alliance = await prisma.alliance.findUnique({
    where: { guildId: guild.id },
  });

  if (!alliance || (!alliance.officerRole && !alliance.battlegroup1Role && !alliance.battlegroup2Role && !alliance.battlegroup3Role)) {
    loggerService.warn({ guildId: guild.id }, 'Attempted to sync roles for an alliance with no roles configured.');
    return { updated: 0, created: 0 };
  }

  const members = await guild.members.fetch();
  let updatedCount = 0;
  let createdCount = 0;

  for (const member of members.values()) {
    // 1. Determine "Target State" based on Discord roles
    let battlegroup: number | null = null;
    let isOfficer = false;
    let hasRelevantRole = false;

    if (alliance.battlegroup1Role && member.roles.cache.has(alliance.battlegroup1Role)) {
      battlegroup = 1;
      hasRelevantRole = true;
    } else if (alliance.battlegroup2Role && member.roles.cache.has(alliance.battlegroup2Role)) {
      battlegroup = 2;
      hasRelevantRole = true;
    } else if (alliance.battlegroup3Role && member.roles.cache.has(alliance.battlegroup3Role)) {
      battlegroup = 3;
      hasRelevantRole = true;
    }

    if (alliance.officerRole && member.roles.cache.has(alliance.officerRole)) {
      isOfficer = true;
      hasRelevantRole = true;
    }

    if (!hasRelevantRole) {
      // Logic could be added here to remove members who lost all roles, 
      // but for safety we generally don't auto-kick from DB yet.
      continue;
    }

    // 2. Find existing player by Discord ID (globally)
    // We use findFirst because discordId is part of a composite unique key, not unique by itself in the schema
    const existingPlayer = await prisma.player.findFirst({
      where: { discordId: member.id },
    });

    if (existingPlayer) {
      // UPDATE existing player
      // We only update if something changed (roles or alliance link)
      if (
        existingPlayer.allianceId !== alliance.id ||
        existingPlayer.battlegroup !== battlegroup ||
        existingPlayer.isOfficer !== isOfficer
      ) {
        await prisma.player.update({
          where: { id: existingPlayer.id },
          data: {
            allianceId: alliance.id,
            battlegroup,
            isOfficer,
          },
        });
        updatedCount++;
      }
    } else {
      // CREATE new player
      await prisma.player.create({
        data: {
          ingameName: member.displayName, // Auto-use Discord display name
          discordId: member.id,
          allianceId: alliance.id,
          battlegroup,
          isOfficer,
        },
      });
      createdCount++;
    }
  }
  
  loggerService.info(`Alliance roles synced for guild ${guild.id}. Updated: ${updatedCount}, Created: ${createdCount}.`);
  return { updated: updatedCount, created: createdCount };
}


export async function handleAllianceSyncRoles(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  try {
    await interaction.editReply('Starting role synchronization... This may take a moment.');
    const result = await syncRolesForGuild(interaction.guild);
    await interaction.followUp(
      `Role synchronization complete.\n` +
      `✅ **${result.created}** new profiles created.\n` +
      `🔄 **${result.updated}** existing profiles updated.`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    loggerService.error({ error: errorMessage }, 'Error syncing alliance roles');
    await interaction.editReply('An error occurred while syncing alliance roles.');
  }
}
