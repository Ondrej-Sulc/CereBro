import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { prisma } from "../../services/prismaService";
import { distributeWarPlan } from "../../services/distribution/warPlanDistributor";
import { capitalize } from "./utils";
import { getActivePlayer } from "../../utils/playerHelper";

export async function handlePlan(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const alliance = await prisma.alliance.findUnique({
    where: { guildId: interaction.guild.id },
  });

  if (!alliance) {
    await interaction.editReply("No alliance configured for this server.");
    return;
  }

  // Permission Check
  const player = await getActivePlayer(interaction.user.id);
  if (!player || (!player.isOfficer && !player.isBotAdmin)) {
      await interaction.editReply("You must be an Alliance Officer or Bot Admin to distribute war plans.");
      return;
  }

  // Ensure they belong to THIS alliance if they aren't a global admin
  if (!player.isBotAdmin && player.allianceId !== alliance.id) {
       await interaction.editReply("You are not an officer of this alliance.");
       return;
  }

  const battlegroup = interaction.options.getInteger("battlegroup", true);
  const targetUser = interaction.options.getUser("player");

  // Find the active War (latest one)
  const war = await prisma.war.findFirst({
    where: { allianceId: alliance.id, status: "PLANNING" },
    orderBy: { createdAt: 'desc' }
  });

  if (!war) {
    await interaction.editReply("No active war found for this alliance.");
    return;
  }

  // If targeting a specific user, resolve their DB ID
  let targetPlayerId: string | undefined;
  if (targetUser) {
      // Find player by Discord ID
      const player = await prisma.player.findFirst({
          where: { discordId: targetUser.id }
      });
      if (!player) {
           await interaction.editReply(`Player ${targetUser.username} is not registered.`);
           return;
      }
      targetPlayerId = player.id;
  }

  const result = await distributeWarPlan(
      interaction.client, 
      alliance.id, 
      war.id, 
      battlegroup, 
      targetPlayerId
  );

  const summary =
    `**AW Plan Distribution (War S${war.season}W${war.warNumber || 'Off'})**\n` +
    `✅ Sent to: ${result.sent.map(capitalize).join(", ") || "None"}\n` +
    `⚠️ Not Found/No Thread: ${result.notFound.map(capitalize).join(", ") || "None"}\n` +
    (result.errors.length > 0 ? `❌ Errors: ${result.errors.join(", ")}` : "");

  await interaction.editReply(summary);
}
