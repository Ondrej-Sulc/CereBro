import { User } from 'discord.js';
import { prisma } from '../services/prismaService.js';
import logger from '../services/loggerService.js';

// Simple in-memory cache to prevent excessive DB writes
// Key: discordId, Value: timestamp of last sync
const lastSyncCache = new Map<string, number>();
const SYNC_COOLDOWN = 1000 * 60 * 60; // 1 hour

/**
 * Synchronizes a Discord user's avatar with the BotUser and all synced Player profiles.
 * @param user The Discord User object
 * @param force Whether to bypass the cooldown
 */
export async function syncUserAvatar(user: User, force = false): Promise<void> {
  const now = Date.now();
  const lastSync = lastSyncCache.get(user.id);

  if (!force && lastSync && now - lastSync < SYNC_COOLDOWN) {
    return;
  }

  try {
    const avatar = user.displayAvatarURL({ extension: 'png', size: 256 });

    // 1. Update BotUser
    await prisma.botUser.upsert({
      where: { discordId: user.id },
      update: { avatar },
      create: { discordId: user.id, avatar }
    });

    // 2. Update all Players that use the Discord avatar
    await prisma.player.updateMany({
      where: {
        discordId: user.id,
        useDiscordAvatar: true
      },
      data: { avatar }
    });

    lastSyncCache.set(user.id, now);
    logger.debug({ discordId: user.id }, 'Synced Discord avatar to database');
  } catch (error) {
    logger.error({ error, discordId: user.id }, 'Failed to sync user avatar');
  }
}
