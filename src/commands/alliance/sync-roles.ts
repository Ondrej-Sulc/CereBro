import { ChatInputCommandInteraction, Guild, MessageFlags } from 'discord.js';
import { prisma } from '../../services/prismaService';
import loggerService from '../../services/loggerService';
import { checkAndCleanupAlliance } from '../../services/allianceService.js';

/**
 * Synchronizes Discord roles for officers and battlegroups with the database for a specific guild.
 * @param guild The guild to sync roles for.
 * @returns An object containing the count of updated, created, and removed players.
 */
export async function syncRolesForGuild(guild: Guild, allianceId?: string): Promise<{ updated: number; created: number; removed: number }> {
  const alliances = await prisma.alliance.findMany({
    where: allianceId ? { id: allianceId, guildId: guild.id } : { guildId: guild.id },
  });

  if (alliances.length === 0) {
    return { updated: 0, created: 0, removed: 0 };
  }

  if (alliances.length > 1) {
    throw new Error('Multiple alliances found for this server. Please specify an alliance ID.');
  }

  const alliance = alliances[0];

  if (!alliance.officerRole && !alliance.battlegroup1Role && !alliance.battlegroup2Role && !alliance.battlegroup3Role) {
    loggerService.warn({ guildId: guild.id }, 'Attempted to sync roles for an alliance with no roles configured.');
    return { updated: 0, created: 0, removed: 0 };
  }

  const members = await guild.members.fetch();
  let updatedCount = 0;
  let createdCount = 0;
  let removedCount = 0;

  // Fetch all players currently linked to this alliance in the DB
  const dbAllianceMembers = await prisma.player.findMany({
    where: { allianceId: alliance.id },
    include: { botUser: true }
  });

  // Create a map for quick lookup and tracking processed members
  // Key: Discord ID, Value: Player record
  const dbMembersMap = new Map(dbAllianceMembers.map(p => [p.discordId, p]));

  for (const member of members.values()) {
    try {
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

      const existingAllianceMember = dbMembersMap.get(member.id);

      if (hasRelevantRole) {
        if (existingAllianceMember) {
          // UPDATE existing alliance member
          if (
            existingAllianceMember.battlegroup !== battlegroup ||
            existingAllianceMember.isOfficer !== isOfficer
          ) {
            await prisma.player.update({
              where: { id: existingAllianceMember.id },
              data: {
                battlegroup,
                isOfficer,
              },
            });
            updatedCount++;
          }
          // Mark as processed
          dbMembersMap.delete(member.id);
        } else {
          // Member has roles but is NOT in the alliance in DB yet.
          // Ensure BotUser exists early
          const botUser = await prisma.botUser.upsert({
            where: { discordId: member.id },
            update: {},
            create: { discordId: member.id }
          });

          let globalPlayer = null;

          if (botUser.activeProfileId) {
            globalPlayer = await prisma.player.findUnique({
              where: { id: botUser.activeProfileId },
            });
          } else {
            globalPlayer = await prisma.player.findFirst({
              where: { discordId: member.id, allianceId: alliance.id },
            });

            if (!globalPlayer) {
              const profileCount = await prisma.player.count({ where: { discordId: member.id } });
              if (profileCount === 1) {
                globalPlayer = await prisma.player.findFirst({
                  where: { discordId: member.id },
                });
              } else if (profileCount > 1) {
                throw new Error('Multiple profiles exist. Please set an active profile to sync roles.');
              }
            }
          }

          if (globalPlayer) {
            // Player exists, link them to this alliance and ensure botUserId
            await prisma.player.update({
              where: { id: globalPlayer.id },
              data: {
                allianceId: alliance.id,
                battlegroup,
                isOfficer,
                botUserId: botUser.id,
                isActive: true // Ensure they are active if they are the primary player
              },
            });
            
            // Ensure activeProfileId is set if not already
            if (!botUser.activeProfileId) {
                await prisma.botUser.update({
                  where: { id: botUser.id },
                  data: { activeProfileId: globalPlayer.id }
                });
            }
            
            updatedCount++;
          } else {
            // New player entirely
            const newPlayer = await prisma.player.create({
              data: {
                ingameName: member.displayName,
                discordId: member.id,
                allianceId: alliance.id,
                battlegroup,
                isOfficer,
                botUserId: botUser.id,
                isActive: true // New profile is active by default
              },
            });

            // Ensure activeProfileId is set
            if (!botUser.activeProfileId) {
                await prisma.botUser.update({
                  where: { id: botUser.id },
                  data: { activeProfileId: newPlayer.id }
                });
            }
            
            createdCount++;
          }
        }
      } else {
        // No relevant roles
        if (existingAllianceMember) {
          // Mark as processed
          dbMembersMap.delete(member.id);

          // Do not remove Bot Admins from the alliance even if they don't have roles
          if (existingAllianceMember.botUser?.isBotAdmin) {
            continue;
          }

          // Skip removal if the alliance has disabled strict membership removal
          if (!alliance.removeMissingMembers) {
            continue;
          }

          // They are in the DB as part of this alliance, but don't have relevant roles in Discord.
          // Since this alliance has roles configured, we treat Discord as the source of truth.
          // Protection for GLOBAL alliance
          if (alliance.id === 'GLOBAL') {
            continue;
          }
          await prisma.player.update({
            where: { id: existingAllianceMember.id },
            data: {
              allianceId: null,
              battlegroup: null,
              isOfficer: false,
            },
          });
          removedCount++;
        }
        // If they don't have roles and aren't in the DB for this alliance, we do nothing.
      }

    } catch (error) {
      loggerService.error(
        { error, memberId: member.id, memberTag: member.user.tag },
        'Failed to sync roles for individual member'
      );
      // Continue processing other members
    }
  }

  // 3. Handle "Leavers"
  // Any players remaining in dbMembersMap were not found in the guild member list.
  // They have left the server, so we remove them from the alliance.
  if (alliance.removeMissingMembers) {
    for (const [discordId, player] of dbMembersMap) {
      try {
        // Do not remove Bot Admins
        if (player.botUser?.isBotAdmin) {
          continue;
        }

        // Protection for GLOBAL alliance
        if (alliance.id === 'GLOBAL') {
          continue;
        }

        await prisma.player.update({
          where: { id: player.id },
          data: {
            allianceId: null,
            battlegroup: null,
            isOfficer: false,
          },
        });
        removedCount++;
      } catch (error) {
        loggerService.error(
          { error, discordId },
          'Failed to remove leaver from alliance'
        );
      }
    }
  }

  // Cleanup empty alliance if everyone left or was removed
  await checkAndCleanupAlliance(alliance.id);

  loggerService.info(`Alliance roles synced for guild ${guild.id}. Updated: ${updatedCount}, Created: ${createdCount}, Removed: ${removedCount}.`);
  return { updated: updatedCount, created: createdCount, removed: removedCount };
}


export async function handleAllianceSyncRoles(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  try {
    await interaction.editReply('Starting role synchronization... This may take a moment.');
    const result = await syncRolesForGuild(interaction.guild);
    await interaction.followUp({
      content: `Role synchronization complete.\n` +
        `✅ **${result.created}** new profiles created.\n` +
        `🔄 **${result.updated}** existing profiles updated.\n` +
        `❌ **${result.removed}** profiles removed (lost roles or left server).`,
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    loggerService.error({ error: errorMessage }, 'Error syncing alliance roles');
    await interaction.editReply('An error occurred while syncing alliance roles.');
  }
}
