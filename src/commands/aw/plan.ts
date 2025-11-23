import {
  ChatInputCommandInteraction,
  ChannelType,
  Collection,
  ThreadChannel,
  MessageFlags,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { prisma } from "../../services/prismaService";
import { getMergedData, getTeamData, getChampionData, getNodes, getWarData } from "./handlers";
import { capitalize, formatAssignment, getEmoji } from "./utils";
import { getPlayer } from "../../utils/playerHelper";

export async function handlePlan(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const { config } = await import("../../config.js");

  const alliance = await prisma.alliance.findUnique({
    where: { guildId: interaction.guild.id },
    include: { config: true },
  });

  if (!alliance?.config?.sheetId) {
    await interaction.editReply(
      "This command is not configured for this server. Please set a Google Sheet ID."
    );
    return;
  }
  const sheetId = alliance.config.sheetId;

  const battlegroup = interaction.options.getInteger("battlegroup", true);
  const targetUser = interaction.options.getUser("player");
  const image = interaction.options.getAttachment("image");

  const bgSheetName = `AW BG${battlegroup}`;
  const channelId = Object.keys(
    config.allianceWar.battlegroupChannelMappings
  ).find(
    (key) =>
      config.allianceWar.battlegroupChannelMappings[key].sheet === bgSheetName
  );

  if (!channelId) {
    await interaction.editReply(
      `Could not find a configured channel for ${bgSheetName}.`
    );
    return;
  }

  const bgConfig = config.allianceWar.battlegroupChannelMappings[channelId];

  // Fetch War Data from Sheet
  const warData = await getWarData(sheetId, bgConfig.sheet);
  if (!warData.season || !warData.warTier) {
      await interaction.editReply("Could not find Season or War Tier info in the sheet. Please check the configured ranges.");
      return;
  }

  // Upsert War Record
  const warNumber = isNaN(warData.warNumber) ? null : warData.warNumber;

  let war;
  if (warNumber !== null) {
    war = await prisma.war.upsert({
      where: {
        allianceId_season_warNumber: {
          allianceId: alliance.id,
          season: warData.season,
          warNumber: warNumber,
        },
      },
      update: { warTier: warData.warTier, enemyAlliance: warData.enemyAlliance },
      create: {
        season: warData.season,
        warTier: warData.warTier,
        warNumber: warNumber,
        enemyAlliance: warData.enemyAlliance,
        allianceId: alliance.id,
      },
    });
  } else {
    war = await prisma.war.findFirst({
      where: {
        allianceId: alliance.id,
        season: warData.season,
        warNumber: null,
      },
    });

    if (war) {
      war = await prisma.war.update({
        where: { id: war.id },
        data: {
          warTier: warData.warTier,
          enemyAlliance: warData.enemyAlliance,
        },
      });
    } else {
      war = await prisma.war.create({
        data: {
          season: warData.season,
          warTier: warData.warTier,
          warNumber: null,
          enemyAlliance: warData.enemyAlliance,
          allianceId: alliance.id,
        },
      });
    }
  }

  const channel = await interaction.client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply(
      `The configured channel for ${bgSheetName} is not a valid text channel.`
    );
    return;
  }

  const activeThreads = await channel.threads.fetch();
  const archivedThreads = await channel.threads.fetchArchived();
  const allThreads = new Collection<string, ThreadChannel>().concat(
    activeThreads.threads,
    archivedThreads.threads
  );
  const threadMap = new Map(allThreads.map((t) => [t.name.toLowerCase(), t]));

  const mergedData = await getMergedData(sheetId, bgConfig.sheet);
  const teamData = await getTeamData(sheetId, bgConfig.sheet);
  const championData = await getChampionData();
  const nodeData = await getNodes();

  const championMap = new Map(championData.map(c => [c.name.toLowerCase(), c]));
  const nodeMap = new Map(nodeData.map(n => [n.nodeNumber.toString(), n]));

  const playerDataMap = new Map<string, {
      assignments: { node: string; formatted: string, raw: any }[];
      prefights: {
        champion: string;
        targetPlayer: string;
        targetNode: string;
        targetDefender: string;
      }[];
    }>();

  for (const assignment of mergedData) {
    const {
      playerName,
      prefightPlayer,
      prefightChampion,
      node,
    } = assignment;

    if (!playerDataMap.has(playerName)) {
      playerDataMap.set(playerName, { assignments: [], prefights: [] });
    }
    if (prefightPlayer && !playerDataMap.has(prefightPlayer)) {
      playerDataMap.set(prefightPlayer, { assignments: [], prefights: [] });
    }

    const formattedAssignment = await formatAssignment(assignment);
    playerDataMap.get(playerName)!.assignments.push({
      node: node,
      formatted: formattedAssignment,
      raw: assignment,
    });

    if (prefightPlayer && prefightChampion) {
      playerDataMap.get(prefightPlayer)!.prefights.push({
        champion: prefightChampion,
        targetPlayer: playerName,
        targetNode: node,
        targetDefender: assignment.defenderName,
      });
      
      const targetAssignment = playerDataMap
        .get(playerName)!
        .assignments.find((a) => a.node === node);
      if (targetAssignment) {
        const prefightEmoji = await getEmoji(prefightChampion);
        targetAssignment.formatted += ` (Prefight: ${prefightEmoji} ${prefightChampion})`;
      }
    }
  }

  const sentTo: string[] = [];
  const notFound: string[] = [];
  const noData: string[] = [];

  const sendPlan = async (playerName: string) => {
    const thread = threadMap.get(playerName);
    const data = playerDataMap.get(playerName);
    const team = teamData.get(playerName);

    if (
      (!data ||
        (data.assignments.length === 0 && data.prefights.length === 0)) &&
      (!team || team.length === 0)
    ) {
      noData.push(playerName);
      return;
    }

    if (!thread) {
      notFound.push(playerName);
      return;
    }
    
    const dbPlayer = await prisma.player.findFirst({ where: { ingameName: { equals: playerName, mode: 'insensitive' } } });
    if (!dbPlayer) {
      notFound.push(`${playerName} (DB)`);
      return;
    }

    const assignmentsByNode = new Map<string, { node: string; formatted: string, raw: any }[]>();
    if (data?.assignments) {
      for (const a of data.assignments) {
        if (!assignmentsByNode.has(a.node)) {
          assignmentsByNode.set(a.node, []);
        }
        assignmentsByNode.get(a.node)!.push(a);
      }
    }

    for (const [_, assignments] of assignmentsByNode) {
      // We assume the main fight details (Attacker, Defender) are consistent across rows for the same node
      const primaryAssignment = assignments[0];
      const attacker = championMap.get(
        primaryAssignment.raw.attackerName.toLowerCase()
      );
      const defender = championMap.get(
        primaryAssignment.raw.defenderName.toLowerCase()
      );
      const node = nodeMap.get(primaryAssignment.raw.node);

      if (attacker && defender && node) {
        // Aggregate prefight champions from all assignments for this node
        const prefightIds = assignments
          .map((a) => a.raw.prefightChampion)
          .filter((name) => name) // filter out empty strings
          .map((name) => championMap.get(name.toLowerCase())?.id)
          .filter((id): id is number => id !== undefined);
        
        const uniquePrefightIds = [...new Set(prefightIds)];

        await prisma.warFight.upsert({
          where: {
            warId_playerId_nodeId: {
              warId: war.id,
              playerId: dbPlayer.id,
              nodeId: node.id,
            },
          },
          update: {
            attackerId: attacker.id,
            defenderId: defender.id,
            death: assignments.some((a) => a.raw.deaths === "1"),
            battlegroup,
            prefightChampions: {
              set: uniquePrefightIds.map((id) => ({ id })),
            },
          },
          create: {
            warId: war.id,
            playerId: dbPlayer.id,
            nodeId: node.id,
            attackerId: attacker.id,
            defenderId: defender.id,
            death: assignments.some((a) => a.raw.deaths === "1"),
            battlegroup,
            prefightChampions: {
              connect: uniquePrefightIds.map((id) => ({ id })),
            },
          },
        });
      }
    }

    const container = new ContainerBuilder().setAccentColor(bgConfig.color);

    if (image) {
      const gallery = new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(image.url)
      );
      container.addMediaGalleryComponents(gallery);
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**AW Plan for ${capitalize(playerName)}**`
      )
    );

    if (team && team.length > 0) {
      const teamEmojis = await Promise.all(team.map((name) => getEmoji(name)));
      const attackersString =
        "**Your Team:**\n" +
        team.map((name, i) => `${teamEmojis[i]} **${name}**`).join(" ");
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(attackersString)
      );
    }

    if (data && data.assignments.length > 0) {
      const assignmentsValue =
        "**Assignments**\n" +
        data.assignments
          .map((a) => `- Node ${a.node}: ${a.formatted}`)
          .join("\n");
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(assignmentsValue)
      );
    }

    if (data && data.prefights.length > 0) {
      const prefightEmojis = await Promise.all(
        data.prefights.map((p) =>
          Promise.all([getEmoji(p.champion), getEmoji(p.targetDefender)])
        )
      );
      const prefightsValue =
        "**Pre-Fights**\n" +
        data.prefights
          .map(
            (p, i) =>
              `- ${prefightEmojis[i][0]} **${p.champion}** for ${capitalize(
                p.targetPlayer
              )}'s ${prefightEmojis[i][1]} **${
                p.targetDefender
              }** on node ${p.targetNode}`
          )
          .join("\n");
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(prefightsValue)
      );
    }

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`generate_upload_link:${war.id}:${dbPlayer.id}`)
        .setLabel("Upload Video(s)")
        .setStyle(ButtonStyle.Primary)
    );

    try {
      await thread.send({
        components: [container, actionRow],
        flags: [MessageFlags.IsComponentsV2],
      });
      sentTo.push(playerName);
    } catch (e) {
      notFound.push(`${playerName} (send error)`);
    }
  };

  if (targetUser) {
    const player = await getPlayer(interaction);
    if (!player) {
      return;
    }
    const playerName = player.ingameName.toLowerCase();
    await sendPlan(playerName);
  } else {
    const planPromises = Array.from(playerDataMap.keys()).map((playerName) =>
      sendPlan(playerName)
    );
    await Promise.all(planPromises);
  }

  const summary =
    `**AW Plan for ${bgConfig.sheet}**\n` +
    `✅ Sent to: ${sentTo.map(capitalize).join(", ") || "None"}\n` +
    `⚠️ No thread/DB entry found for: ${notFound.map(capitalize).join(", ") || "None"}\n` +
    `ℹ️ No data for: ${noData.map(capitalize).join(", ") || "None"}`;

  await interaction.editReply(summary);
}