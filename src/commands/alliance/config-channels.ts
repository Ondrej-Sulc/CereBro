import { ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { prisma } from '../../services/prismaService';

export async function handleAllianceConfigChannels(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  const warVideosChannel = interaction.options.getChannel('war-videos');
  const bg1Channel = interaction.options.getChannel('bg1-channel');
  const bg2Channel = interaction.options.getChannel('bg2-channel');
  const bg3Channel = interaction.options.getChannel('bg3-channel');

  if (!warVideosChannel && !bg1Channel && !bg2Channel && !bg3Channel) {
    await interaction.editReply('Please specify at least one channel to configure.');
    return;
  }

  const data: any = {};
  let summary = 'Successfully updated alliance channel configuration:\n';

  const validateAndAdd = async (channel: any, key: string, label: string) => {
    if (channel) {
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
            throw new Error(`The ${label} channel must be a Text Channel or Announcement Channel.`);
        }
        data[key] = channel.id;
        summary += `- **${label}:** <#${channel.id}>\n`;
    }
  };

  try {
      await validateAndAdd(warVideosChannel, 'warVideosChannelId', 'War Videos');
      await validateAndAdd(bg1Channel, 'battlegroup1ChannelId', 'Battlegroup 1');
      await validateAndAdd(bg2Channel, 'battlegroup2ChannelId', 'Battlegroup 2');
      await validateAndAdd(bg3Channel, 'battlegroup3ChannelId', 'Battlegroup 3');
  } catch (e: any) {
      await interaction.editReply(e.message);
      return;
  }

  await prisma.alliance.update({
    where: { guildId: interaction.guildId },
    data,
  });

  await interaction.editReply(summary);
}