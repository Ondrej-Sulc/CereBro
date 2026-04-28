import { ChatInputCommandInteraction, MessageFlags, AutocompleteInteraction } from "discord.js";
import { prisma } from "../../services/prismaService";
import { distributeWarPlan } from "../../services/distribution/warPlanDistributor";
import { capitalize } from "./utils";
import { getActivePlayer } from "../../utils/playerHelper";
import { getAlliance } from "../../utils/allianceHelper";

export async function handlePlanAutocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const battlegroup = interaction.options.getInteger("battlegroup") || undefined;
  
  if (!interaction.guild) {
      await interaction.respond([]);
      return;
  }
  
  const alliance = await getAlliance(interaction);
  if (!alliance) {
      await interaction.respond([]);
      return;
  }
  
  const whereClause: any = { allianceId: alliance.id };
  if (battlegroup) {
      whereClause.battlegroup = battlegroup;
  }
  
  const players = await prisma.player.findMany({
      where: whereClause,
      select: { id: true, ingameName: true }
  });
  
  const filtered = players
      .filter(p => p.ingameName.toLowerCase().includes(focusedValue))
      .slice(0, 25);
      
  await interaction.respond(
      filtered.map(p => ({ name: p.ingameName, value: p.id }))
  );
}

export async function handlePlan(interaction: ChatInputCommandInteraction) {
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
  const activePlayer = await getActivePlayer(interaction.user.id);
  if (!activePlayer || (!activePlayer.isOfficer && !activePlayer.isBotAdmin)) {
      await interaction.editReply("You must be an Alliance Officer or Bot Admin to distribute war plans.");
      return;
  }

  // Ensure they belong to THIS alliance if they aren't a global admin
  if (!activePlayer.isBotAdmin && activePlayer.allianceId !== alliance.id) {
       await interaction.editReply("You are not an officer of this alliance.");
       return;
  }

  const battlegroup = interaction.options.getInteger("battlegroup", true);
  const targetPlayerId = interaction.options.getString("player") || undefined;

  // Find the active War (latest one)
  const war = await prisma.war.findFirst({
    where: { allianceId: alliance.id, status: "PLANNING" },
    orderBy: { createdAt: 'desc' }
  });

  if (!war) {
    await interaction.editReply("No active war found for this alliance.");
    return;
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
