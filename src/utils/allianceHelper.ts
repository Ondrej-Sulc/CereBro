import { ChatInputCommandInteraction, ButtonInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, MessageFlags } from "discord.js";
import { Alliance } from "@prisma/client";
import { prisma } from "../services/prismaService.js";
import { getActivePlayer } from "./playerHelper.js";

/**
 * Gets the alliance for the current interaction.
 * In servers with multiple alliances, it tries to use the user's active profile alliance.
 * If the user has no active profile in an alliance on this server, it might need to ask (not implemented in this base helper yet).
 */
export async function getAlliance(
  interaction: ChatInputCommandInteraction | ButtonInteraction
): Promise<Alliance | null> {
  const guildId = interaction.guildId;
  if (!guildId) return null;

  // 1. Try to find alliance via the user's active player profile
  const activePlayer = await getActivePlayer(interaction.user.id);
  if (activePlayer?.allianceId) {
    const alliance = await prisma.alliance.findUnique({
        where: { id: activePlayer.allianceId }
    });
    // Verify the alliance belongs to this guild
    if (alliance && alliance.guildId === guildId) {
        return alliance;
    }
  }

  // 2. Fallback: Find alliances in this guild
  const alliances = await prisma.alliance.findMany({
    where: { guildId }
  });

  if (alliances.length === 0) {
    return null;
  }

  if (alliances.length === 1) {
    return alliances[0];
  }

  // 3. Multi-alliance server and user not linked to any of them
  // For now, we return the first one but in the future we should probably prompt
  // or return null and let the command handle the selection.
  // Actually, for most "USER" commands, returning the first one is risky.
  // But for "ALLIANCE_ADMIN" commands, the admin might need to specify.
  return alliances[0];
}
