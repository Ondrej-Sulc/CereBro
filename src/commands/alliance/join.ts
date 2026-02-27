import { ChatInputCommandInteraction } from "discord.js";
import { safeReply } from "../../utils/errorHandler";
import { getPlayer } from "../../utils/playerHelper";
import { checkAndCleanupAlliance } from "../../services/allianceService.js";

export async function handleAllianceJoin(interaction: ChatInputCommandInteraction) {
  const { prisma } = await import("../../services/prismaService.js");
  const player = await getPlayer(interaction);

  if (!player) {
    // getPlayer already sends a reply
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  const oldAllianceId = player.allianceId;

  const alliance = await prisma.alliance.upsert({
    where: { guildId: guild.id },
    update: { name: guild.name },
    create: { guildId: guild.id, name: guild.name },
  });

  await prisma.player.update({
    where: { id: player.id },
    data: { allianceId: alliance.id },
  });

  // Cleanup old alliance if empty
  if (oldAllianceId && oldAllianceId !== alliance.id) {
    await checkAndCleanupAlliance(oldAllianceId);
  }

  await safeReply(interaction, `You have successfully joined the **${alliance.name}** alliance.`);
}
