import { User, ChatInputCommandInteraction, ButtonInteraction, ApplicationCommandOptionType } from "discord.js";
import { Player } from "@prisma/client";
import { safeReply } from "./errorHandler";
import { prisma } from "../services/prismaService.js";

import { Prisma } from "@prisma/client";

export type ActivePlayerWithAlliance = Prisma.PlayerGetPayload<{
  include: { alliance: true }
}> & { isBotAdmin: boolean };

export async function getActivePlayer(discordId: string): Promise<ActivePlayerWithAlliance | null> {
  // 1. Fetch the BotUser for global permissions
  const botUser = await prisma.botUser.findUnique({
    where: { discordId }
  });

  // 2. Fetch the Profile
  // Try isActive: true first
  let player = await prisma.player.findFirst({
    where: { 
      discordId,
      isActive: true,
    },
    include: { alliance: true }
  }) as ActivePlayerWithAlliance | null;

  // Fallback 1: Use activeProfileId if set
  if (!player && botUser?.activeProfileId) {
    player = await prisma.player.findUnique({
        where: { id: botUser.activeProfileId },
        include: { alliance: true }
    }) as ActivePlayerWithAlliance | null;
  }

  // Fallback 2: If no active player, return the first one found for this user
  if (!player) {
    player = await prisma.player.findFirst({
      where: { discordId },
      include: { alliance: true }
    }) as ActivePlayerWithAlliance | null;
  }

  if (player && botUser) {
    player.isBotAdmin = botUser.isBotAdmin;
    return player;
  }

  return null;
}

/**
 * Checks if the caller is authorized to manage (update/delete) the target player's data.
 * Authorization rules:
 * 1. Bot Admins can manage anyone.
 * 2. Players can manage their own profiles.
 * 3. Alliance Officers can manage members of their own alliance.
 */
export function isAuthorizedToManage(caller: ActivePlayerWithAlliance, target: ActivePlayerWithAlliance): boolean {
  if (caller.isBotAdmin) return true;
  if (caller.id === target.id) return true;
  if (caller.allianceId && caller.allianceId === target.allianceId && caller.isOfficer) return true;
  return false;
}

export async function getPlayer(
  interaction: ChatInputCommandInteraction | ButtonInteraction
): Promise<ActivePlayerWithAlliance | null> {
  let targetUser: User;
  if (interaction.isChatInputCommand()) {
    const playerOption = interaction.options.get("player");
    if (playerOption && playerOption.type === ApplicationCommandOptionType.User) {
        targetUser = playerOption.user!;
    } else {
        targetUser = interaction.user;
    }
  } else {
    targetUser = interaction.user;
  }

  const activePlayer = await getActivePlayer(targetUser.id);

  if (!activePlayer) {
    await safeReply(interaction, `Player ${targetUser.username} has no registered profiles. Please use the /register command.`);
    return null;
  }
  
  return activePlayer;
}
