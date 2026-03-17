import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getActivePlayer, getPlayer, isAuthorizedToManage } from "../../utils/playerHelper";
import { deleteRoster } from "../../services/rosterService";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import { Prisma } from "@prisma/client";

registerButtonHandler("roster_delete_all_confirm", async (interaction) => {
  const playerId = interaction.customId.split(":")[1];
  if (!playerId) {
    await interaction.reply({
      content: "Error: Player ID not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const result = await deleteRoster({ playerId });
  await interaction.update({ content: `${result}.`, components: [] });
});

registerButtonHandler("roster_delete_all_cancel", async (interaction) => {
  await interaction.update({
    content: "Roster deletion cancelled.",
    components: [],
  });
});

export async function handleDelete(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const callerPlayer = await getActivePlayer(interaction.user.id);
  const targetPlayer = await getPlayer(interaction);
  if (!targetPlayer) {
    return;
  }

  if (!callerPlayer) {
    await interaction.editReply("❌ Your profile not found. Please register first.");
    return;
  }

  if (!isAuthorizedToManage(callerPlayer, targetPlayer)) {
    await interaction.editReply(`❌ You are not authorized to delete **${targetPlayer.ingameName}**'s roster. Only the player themselves, bot admins, or alliance officers can do this.`);
    return;
  }

  const championId = interaction.options.getString("champion");
  const stars = interaction.options.getInteger("stars");
  const rank = interaction.options.getInteger("rank");
  const isAscended = interaction.options.getBoolean("is_ascended");

  if (!championId && !stars && !rank && isAscended === null) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`roster_delete_all_confirm:${targetPlayer.id}`)
        .setLabel("Yes, delete all")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("roster_delete_all_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: `Are you sure you want to delete the entire roster for ${targetPlayer.ingameName}? This action cannot be undone.`,
      components: [row],
    });
  } else {
    const where: Prisma.RosterWhereInput = {
      playerId: targetPlayer.id,
    };
    if (championId) {
      where.championId = parseInt(championId, 10);
    }
    if (stars) {
      where.stars = stars;
    }
    if (rank) {
      where.rank = rank;
    }
    if (isAscended !== null) {
      where.isAscended = isAscended;
    }
    const result = await deleteRoster(where);
    await interaction.editReply({
      content: `${result} for ${targetPlayer.ingameName}.`,
    });
  }
}
