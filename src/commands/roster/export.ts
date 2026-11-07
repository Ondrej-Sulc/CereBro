import {
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import { getPlayer } from "../../utils/playerHelper";
import { getRoster } from "../../services/rosterService";
import { normalizeRosterAscensionState } from "../../domain/roster-ascension-state.js";

export async function handleExport(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const player = await getPlayer(interaction);
  if (!player) {
    return;
  }

  const roster = await getRoster(player.id, null, null, null);

  if (typeof roster === "string") {
    await interaction.editReply({ content: roster });
    return;
  }

  let csv = "Champion,Stars,Rank,IsAwakened,IsAscended,SigLevel,AscensionLevel\n";
  roster.forEach((entry) => {
    const sigLevel = entry.isAwakened ? entry.sigLevel ?? 0 : 0;
    const ascension = normalizeRosterAscensionState(entry);
    const name = entry.champion.name.replace(/"/g, '""');
    csv += `"${name}",${entry.stars},${entry.rank},${entry.isAwakened},${ascension.isAscended},${sigLevel},${ascension.ascensionLevel}\n`;
  });

  const attachment = new AttachmentBuilder(Buffer.from(csv), {
    name: `${player.ingameName}-roster.csv`,
  });

  await interaction.editReply({
    content: `Roster for ${player.ingameName} exported.`,
    files: [attachment],
  });
}
