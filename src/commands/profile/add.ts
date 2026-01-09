import { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../../services/prismaService';
import { safeReply } from '../../utils/errorHandler';

export async function handleProfileAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const ingameName = interaction.options.getString('name', true);
  const discordId = interaction.user.id;

  const botUser = await prisma.botUser.findUnique({
    where: { discordId }
  });

  if (!botUser) {
    await safeReply(interaction, "You need to register your first account with `/register` before you can add more.");
    return;
  }

  const existingProfile = await prisma.player.findUnique({
    where: {
      discordId_ingameName: {
        discordId,
        ingameName,
      },
    },
  });

  if (existingProfile) {
    await safeReply(interaction, `You already have a profile named **${ingameName}**.`);
    return;
  }

  const guild = interaction.guild;
  let allianceId: string | null = null;

  if (guild) {
    const alliance = await prisma.alliance.findUnique({
        where: { guildId: guild.id },
    });
    if(alliance) {
        allianceId = alliance.id;
    }
  }

  await prisma.player.create({
    data: {
      discordId,
      ingameName,
      allianceId,
      isActive: false, // Subsequent profiles are not active by default
      botUserId: botUser.id
    },
  });

  await safeReply(interaction, `✅ Successfully added profile **${ingameName}**. You can switch to it using \`/profile switch\`.`);
}
