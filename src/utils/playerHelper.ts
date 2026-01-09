import { User, ChatInputCommandInteraction, ButtonInteraction, ApplicationCommandOptionType } from "discord.js";
import { Player } from "@prisma/client";
import { safeReply } from "./errorHandler";

export async function getActivePlayer(discordId: string): Promise<Player | null> {
  const { prisma } = await import("../services/prismaService.js");
  
  // 1. Fetch the BotUser for global permissions
  const botUser = await prisma.botUser.findUnique({
    where: { discordId }
  });

  // 2. Fetch the Profile
  let player = await prisma.player.findFirst({
    where: { 
      discordId,
      isActive: true,
    },
  });

  if (!player) {
    // If no active player, return the first one found
    player = await prisma.player.findFirst({
      where: { discordId },
    });
  }

  if (player && botUser) {
    return {
        ...player,
        isBotAdmin: botUser.isBotAdmin
    };
  }

  return player;
}

export async function getPlayer(
  interaction: ChatInputCommandInteraction | ButtonInteraction
): Promise<Player | null> {
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
