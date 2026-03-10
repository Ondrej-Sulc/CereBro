
import { ChatInputCommandInteraction, PermissionsBitField } from 'discord.js';
import { safeReply } from '../../utils/errorHandler';
import { getAlliance } from '../../utils/allianceHelper';

export async function handleAllianceToggleFeature(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { prisma } = await import('../../services/prismaService.js');
  if (!interaction.guild) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    await safeReply(interaction, "You must be an administrator to use this command.");
    return;
  }

  const featureName = interaction.options.getString('feature', true);
  const enabled = interaction.options.getBoolean('enabled', true);

  const alliance = await getAlliance(interaction);

  if (!alliance) {
    await safeReply(interaction, "Could not determine your alliance.");
    return;
  }

  const currentlyEnabled = alliance.enabledFeatureCommands;
  let updatedEnabled: string[];

  if (enabled) {
    // Add the feature to the enabled list if it's not already there
    if (!currentlyEnabled.includes(featureName)) {
      updatedEnabled = [...currentlyEnabled, featureName];
    } else {
      updatedEnabled = currentlyEnabled;
    }
  } else {
    // Remove the feature from the enabled list
    updatedEnabled = currentlyEnabled.filter((cmd) => cmd !== featureName);
  }

  await prisma.alliance.update({
    where: { id: alliance.id },
    data: { enabledFeatureCommands: updatedEnabled },
  });

  await safeReply(
    interaction,
    `✅ Feature **${featureName}** has been **${enabled ? 'enabled' : 'disabled'}** for this alliance.`
  );
}
