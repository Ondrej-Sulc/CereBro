import { ChatInputCommandInteraction, StringSelectMenuInteraction, ModalSubmitInteraction } from 'discord.js';
import { prisma } from '../../services/prismaService';
import { safeReply } from '../../utils/errorHandler';

export async function handleProfileSwitch(interaction: ChatInputCommandInteraction | StringSelectMenuInteraction | ModalSubmitInteraction, ingameName?: string): Promise<void> {
  const discordId = interaction.user.id;

  // If ingameName is not provided (e.g., from a slash command), get it from options
  const profileName = ingameName || (interaction as ChatInputCommandInteraction).options.getString('name', true);

  const profiles = await prisma.player.findMany({
    where: { discordId },
  });

  if (profiles.length <= 1) {
    await safeReply(interaction, "You only have one profile, so there's nothing to switch.");
    return;
  }

  const targetProfile = profiles.find(p => p.ingameName === profileName);

  if (!targetProfile) {
    await safeReply(interaction, `You don't have a profile named **${profileName}**.`);
    return;
  }

  if (targetProfile.isActive) {
    await safeReply(interaction, `**${profileName}** is already your active profile.`);
    return;
  }

  // Using a transaction to ensure atomicity
  await prisma.$transaction([
    // Set all profiles to inactive
    prisma.player.updateMany({
      where: {
        discordId,
      },
      data: {
        isActive: false,
      },
    }),
    // Set the target profile to active
    prisma.player.update({
      where: {
        id: targetProfile.id,
      },
      data: {
        isActive: true,
      },
    }),
    // Update activeProfileId in BotUser
    prisma.botUser.update({
        where: { discordId },
        data: { activeProfileId: targetProfile.id }
    })
  ]);

  await safeReply(interaction, `✅ Switched active profile to **${profileName}**.`);
}
