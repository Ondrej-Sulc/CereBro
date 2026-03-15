import { Player, Alliance } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";

type PrestigeType = "summoner" | "champion" | "relic";

const prestigeLabels: Record<PrestigeType, string> = {
  summoner: "Summoner",
  champion: "Champion",
  relic: "Relic",
};

function buildLeaderboardContainer(
  players: (Player & { alliance?: Alliance | null })[],
  prestigeType: PrestigeType
): any {
  const container = new ContainerBuilder();
  container.setAccentColor(0xffd700); // Gold color

  const title = `# 🏆 ${prestigeLabels[prestigeType]} Prestige Leaderboard 🏆`;

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(title));
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const prestigeField = `${prestigeType}Prestige` as const;

  const sortedPlayers = [...players]
    .filter((p) => p[prestigeField] !== null)
    .sort((a, b) => (b[prestigeField] ?? 0) - (a[prestigeField] ?? 0));

  const alliancesCount = new Set(players.map((p) => p.allianceId).filter(Boolean)).size;

  let leaderboardString = "";
  if (sortedPlayers.length > 0) {
    sortedPlayers.forEach((p, index) => {
      const prestigeValue = p[prestigeField];
      let rank = index + 1;
      const allianceTag = (alliancesCount > 1 && p.alliance?.name) ? ` [${p.alliance.name}]` : "";
      let line = `${rank}. **${p.ingameName}**${allianceTag} - ${prestigeValue}`;

      if (rank === 1) line = `## 🥇 ${line}`;
      if (rank === 2) line = `### 🥈 ${line}`;
      if (rank === 3) line = `### 🥉 ${line}`;

      leaderboardString += line + "\n";
    });
  } else {
    leaderboardString = "No players with this prestige type found.";
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(leaderboardString)
  );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...Object.keys(prestigeLabels).map((key) => {
      const type = key as PrestigeType;
      return new ButtonBuilder()
        .setCustomId(`prestige:leaderboard:${type}`)
        .setLabel(prestigeLabels[type])
        .setStyle(prestigeType === type ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(prestigeType === type);
    })
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  // This is not officially documented, but we are trying it based on user feedback.
  (container.components as any[]).push(buttons);

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

async function getPlayersWithAlliance(prisma: any, guildId: string) {
  return prisma.player.findMany({
    where: {
      alliance: {
        guildId: guildId,
      },
    },
    include: {
      alliance: true,
    },
  });
}

export async function handleLeaderboard(
  interaction: ChatInputCommandInteraction
) {
  const { prisma } = await import("../../services/prismaService.js");
  await interaction.deferReply();
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const players = await getPlayersWithAlliance(prisma, guildId);

  if (players.length === 0) {
    await interaction.editReply("No players found in this server.");
    return;
  }

  const leaderboardResponse = buildLeaderboardContainer(players, "summoner");
  await interaction.editReply(leaderboardResponse);
}

async function handleLeaderboardButton(interaction: ButtonInteraction) {
  const { prisma } = await import("../../services/prismaService.js");
  await interaction.deferUpdate();
  const guildId = interaction.guildId;
  if (!guildId) {
    // This should not happen as buttons are guild-specific
    return;
  }

  const customIdParts = interaction.customId.split(":");
  const prestigeType = customIdParts[2] as PrestigeType;

  const players = await getPlayersWithAlliance(prisma, guildId);

  // No need to check for players.length === 0, as the message already exists.

  const leaderboardResponse = buildLeaderboardContainer(players, prestigeType);
  await interaction.editReply(leaderboardResponse);
}

export function registerPrestigeHandlers() {
  registerButtonHandler(
    "prestige:leaderboard",
    handleLeaderboardButton
  );
}