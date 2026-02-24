import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { prisma } from '../../services/prismaService';
import loggerService from '../../services/loggerService';
import { syncRolesForGuild } from './sync-roles';

export async function handleAllianceConfigRoles(interaction: ChatInputCommandInteraction) {
  const officerRole = interaction.options.getRole('officer');
  const bg1Role = interaction.options.getRole('battlegroup1');
  const bg2Role = interaction.options.getRole('battlegroup2');
  const bg3Role = interaction.options.getRole('battlegroup3');
  const removeMissingMembers = interaction.options.getBoolean('remove-missing-members');

  if (!interaction.guildId || !interaction.guild) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  try {
    const updateData: {
      officerRole?: string;
      battlegroup1Role?: string;
      battlegroup2Role?: string;
      battlegroup3Role?: string;
      removeMissingMembers?: boolean;
    } = {};

    if (officerRole) updateData.officerRole = officerRole.id;
    if (bg1Role) updateData.battlegroup1Role = bg1Role.id;
    if (bg2Role) updateData.battlegroup2Role = bg2Role.id;
    if (bg3Role) updateData.battlegroup3Role = bg3Role.id;
    if (removeMissingMembers !== null) updateData.removeMissingMembers = removeMissingMembers;

    if (Object.keys(updateData).length === 0) {
      // If no roles are provided, show the current configuration
      const alliance = await prisma.alliance.findUnique({
        where: { guildId: interaction.guildId },
      });

      if (!alliance) {
        await interaction.editReply('This server is not registered as an alliance.');
        return;
      }

      let replyMessage = 'Current Alliance Role Configuration:\n';
      replyMessage += `- Officer Role: ${alliance.officerRole ? `<@&${alliance.officerRole}>` : 'Not set'}\n`;
      replyMessage += `- Battlegroup 1 Role: ${alliance.battlegroup1Role ? `<@&${alliance.battlegroup1Role}>` : 'Not set'}\n`;
      replyMessage += `- Battlegroup 2 Role: ${alliance.battlegroup2Role ? `<@&${alliance.battlegroup2Role}>` : 'Not set'}\n`;
      replyMessage += `- Battlegroup 3 Role: ${alliance.battlegroup3Role ? `<@&${alliance.battlegroup3Role}>` : 'Not set'}\n`;
      replyMessage += `- Remove Missing Members: ${alliance.removeMissingMembers ? '✅ Enabled' : '❌ Disabled'}\n`;
      
      await interaction.editReply(replyMessage);
      return;
    }

    const alliance = await prisma.alliance.update({
      where: { guildId: interaction.guildId },
      data: updateData,
    });

    let replyMessage = '✅ Alliance roles have been updated. Now running automatic sync...\n';
    if (alliance.officerRole) replyMessage += `- Officer Role: <@&${alliance.officerRole}>\n`;
    if (alliance.battlegroup1Role) replyMessage += `- Battlegroup 1 Role: <@&${alliance.battlegroup1Role}>\n`;
    if (alliance.battlegroup2Role) replyMessage += `- Battlegroup 2 Role: <@&${alliance.battlegroup2Role}>\n`;
    if (alliance.battlegroup3Role) replyMessage += `- Battlegroup 3 Role: <@&${alliance.battlegroup3Role}>\n`;
    replyMessage += `- Remove Missing Members: ${alliance.removeMissingMembers ? '✅ Enabled' : '❌ Disabled'}\n`;

    await interaction.editReply(replyMessage);
    loggerService.info(`Alliance roles configured for guild ${interaction.guildId} by ${interaction.user.tag}`);

    const result = await syncRolesForGuild(interaction.guild);
    await interaction.followUp({
        content: `Automatic sync complete.\n` +
        `✅ **${result.created}** new profiles created.\n` +
        `🔄 **${result.updated}** existing profiles updated.\n` +
        `❌ **${result.removed}** profiles removed.`,
        flags: [MessageFlags.Ephemeral]
      });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    loggerService.error({ error: errorMessage }, 'Error configuring alliance roles');
    await interaction.editReply('An error occurred while configuring alliance roles.');
  }
}
