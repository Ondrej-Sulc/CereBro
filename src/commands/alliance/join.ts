import { ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType } from "discord.js";
import { safeReply } from "../../utils/errorHandler";
import { getPlayer } from "../../utils/playerHelper";
import { checkAndCleanupAlliance } from "../../services/allianceService.js";

export async function handleAllianceJoin(interaction: ChatInputCommandInteraction) {
  const { prisma } = await import("../../services/prismaService.js");
  const player = await getPlayer(interaction);

  if (!player) {
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  const oldAllianceId = player.allianceId;

  const alliances = await prisma.alliance.findMany({
    where: { guildId: guild.id },
  });

  if (alliances.length === 0) {
    const alliance = await prisma.alliance.create({
      data: { guildId: guild.id, name: guild.name },
    });
    
    await prisma.player.update({
      where: { id: player.id },
      data: { allianceId: alliance.id },
    });
    
    if (oldAllianceId && oldAllianceId !== alliance.id) {
      await checkAndCleanupAlliance(oldAllianceId);
    }
    
    await safeReply(interaction, `You have successfully created and joined the **${alliance.name}** alliance.`);
    return;
  }

  if (alliances.length === 1) {
    const alliance = alliances[0];
    await prisma.player.update({
      where: { id: player.id },
      data: { allianceId: alliance.id },
    });
    
    if (oldAllianceId && oldAllianceId !== alliance.id) {
      await checkAndCleanupAlliance(oldAllianceId);
    }
    
    await safeReply(interaction, `You have successfully joined the **${alliance.name}** alliance.`);
    return;
  }

  const options = alliances.map((a) => ({
    label: a.name.substring(0, 100),
    value: a.id,
    description: `Join ${a.name}`.substring(0, 100),
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("select_alliance_join")
    .setPlaceholder("Select an alliance to join")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: "This server has multiple alliances. Please select which one you want to join:",
      components: [row],
    });
  } else {
    await interaction.reply({
      content: "This server has multiple alliances. Please select which one you want to join:",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    const confirmation = await interaction.channel?.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id && i.customId === "select_alliance_join",
        time: 60000,
        componentType: ComponentType.StringSelect,
    });

    if (!confirmation) return;

    const selectedAllianceId = confirmation.values[0];
    const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId)!;

    await prisma.player.update({
        where: { id: player.id },
        data: { allianceId: selectedAlliance.id },
    });

    if (oldAllianceId && oldAllianceId !== selectedAlliance.id) {
        await checkAndCleanupAlliance(oldAllianceId);
    }

    await confirmation.update({
        content: `You have successfully joined the **${selectedAlliance.name}** alliance.`,
        components: [],
    });
  } catch (e) {
      await interaction.editReply({
          content: "Selection timed out or was cancelled.",
          components: [],
      });
  }
}