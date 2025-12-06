import { ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { prisma } from '../../services/prismaService';

export async function handleAllianceConfigChannels(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  const warVideosChannel = interaction.options.getChannel('war-videos');

  if (!warVideosChannel) {
    await interaction.editReply('Please specify a channel to configure.');
    return;
  }

  // Validate channel type (Text or Announcement)
  // Note: addChannelTypes in builder should handle this, but good to be safe
  if (warVideosChannel.type !== ChannelType.GuildText && warVideosChannel.type !== ChannelType.GuildAnnouncement) {
      await interaction.editReply('The specified channel must be a Text Channel or Announcement Channel.');
      return;
  }

  await prisma.alliance.update({
    where: { guildId: interaction.guildId },
    data: {
      warVideosChannelId: warVideosChannel.id,
    },
  });

  await interaction.editReply(`Successfully updated alliance channel configuration:\n- **War Videos:** <#${warVideosChannel.id}>`);
}
