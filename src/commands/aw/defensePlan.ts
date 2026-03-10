import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { prisma } from "../../services/prismaService";
import { distributeDefensePlan } from "../../services/distribution/defensePlanDistributor";
import { capitalize } from "./utils";
import { getActivePlayer } from "../../utils/playerHelper";
import { getAlliance } from "../../utils/allianceHelper";

export async function handleDefensePlan(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const alliance = await getAlliance(interaction);

  if (!alliance) {
    await interaction.editReply("No alliance configured for this server.");
    return;
  }

  // Permission Check
  const player = await getActivePlayer(interaction.user.id);
  if (!player || (!player.isOfficer && !player.isBotAdmin)) {
      await interaction.editReply("You must be an Alliance Officer or Bot Admin to distribute defense plans.");
      return;
  }

  // Ensure they belong to THIS alliance if they aren't a global admin
  if (!player.isBotAdmin && player.allianceId !== alliance.id) {
       await interaction.editReply("You are not an officer of this alliance.");
       return;
  }

  const battlegroup = interaction.options.getInteger("battlegroup") || undefined;

  const result = await distributeDefensePlan(
      interaction.client, 
      alliance.id, 
      battlegroup
  );

  const summary =
    `**🛡️ Defense Plan Distribution**\n` +
    `✅ Sent to: ${result.sent.join(", ") || "None"}\n` +
    `⚠️ Not Found/No Data: ${[...result.notFound, ...result.noData].join(", ") || "None"}\n` +
    (result.errors.length > 0 ? `❌ Errors: ${result.errors.join(", ")}` : "");

  await interaction.editReply(summary);
}
