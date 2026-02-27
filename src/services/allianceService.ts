import { prisma } from './prismaService.js';
import loggerService from './loggerService.js';

/**
 * Checks if an alliance has any members. If not, deletes the alliance record.
 * @param allianceId The ID of the alliance to check.
 * @returns Promise<boolean> True if the alliance was deleted, false otherwise.
 */
export async function checkAndCleanupAlliance(allianceId: string | null | undefined): Promise<boolean> {
  if (!allianceId || allianceId === "GLOBAL") return false;

  try {
    return await prisma.$transaction(async (tx) => {
      const memberCount = await tx.player.count({
        where: { allianceId }
      });

      if (memberCount === 0) {
        const alliance = await tx.alliance.findUnique({
          where: { id: allianceId },
          select: { name: true, guildId: true }
        });

        if (!alliance) return false;

        await tx.alliance.delete({
          where: { id: allianceId }
        });

        loggerService.info({ 
          allianceId, 
          allianceName: alliance.name, 
          guildId: alliance.guildId 
        }, `Empty alliance record "${alliance.name}" deleted automatically.`);
        
        return true;
      }
      return false;
    });
  } catch (error) {
    loggerService.error({ error, allianceId }, 'Error checking or cleaning up empty alliance');
  }

  return false;
}
