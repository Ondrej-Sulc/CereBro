import {
  ChatInputCommandInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { capitalize, getEmoji } from "./utils";
import { prisma } from "../../services/prismaService";

export async function handleDetails(interaction: ChatInputCommandInteraction) {
  const { config } = await import("../../config.js");
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  // 1. Fetch Alliance and determine Battlegroup from Channel
  const alliance = await prisma.alliance.findUnique({
    where: { guildId: interaction.guild.id },
  });

  if (!alliance) {
    await interaction.editReply("This server is not registered as an alliance.");
    return;
  }

  if (!interaction.channel || !interaction.channel.isThread()) {
    await interaction.editReply(
      "This command can only be used in a player's war thread."
    );
    return;
  }

  const parentChannelId = interaction.channel.parentId;
  if (!parentChannelId) {
    await interaction.editReply("This thread is not in a valid channel.");
    return;
  }

  let bgNumber = 0;
  let bgColor = 0x808080; // Default gray

  if (parentChannelId === alliance.battlegroup1ChannelId) {
    bgNumber = 1;
    bgColor = parseInt(alliance.battlegroup1Color.replace("#", ""), 16);
  } else if (parentChannelId === alliance.battlegroup2ChannelId) {
    bgNumber = 2;
    bgColor = parseInt(alliance.battlegroup2Color.replace("#", ""), 16);
  } else if (parentChannelId === alliance.battlegroup3ChannelId) {
    bgNumber = 3;
    bgColor = parseInt(alliance.battlegroup3Color.replace("#", ""), 16);
  } else {
    // Fallback to config if DB mapping fails (backward compatibility)
    const legacyConfig =
      config.allianceWar.battlegroupChannelMappings[parentChannelId];
    if (legacyConfig) {
      bgColor = legacyConfig.color;
      // We can't determine bgNumber safely from legacy config keys reliably without mapping,
      // but if we are here, we might fail on DB lookups anyway.
      // Let's assume we need DB setup.
      await interaction.editReply(
        "This channel is not configured as a Battlegroup channel in the database settings."
      );
      return;
    }

    await interaction.editReply(
      "This thread is not in a recognized battlegroup channel."
    );
    return;
  }

  // 2. Identify Player
  const threadName = interaction.channel.name.toLowerCase().trim();
  // Find player in alliance whose name matches thread name
  const player = await prisma.player.findFirst({
    where: {
      allianceId: alliance.id,
      ingameName: {
        mode: "insensitive",
        equals: threadName,
      },
    },
  });

  if (!player) {
    await interaction.editReply(
      `Could not find a player named "${interaction.channel.name}" in this alliance.`
    );
    return;
  }

  // 3. Fetch Active War
  const war = await prisma.war.findFirst({
    where: {
      allianceId: alliance.id,
      status: "PLANNING",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!war) {
    await interaction.editReply("There is no active war in Planning phase.");
    return;
  }

  // 4. Fetch Fights
  const fights = await prisma.warFight.findMany({
    where: {
      warId: war.id,
      playerId: player.id,
    },
    include: {
      node: {
        include: {
          allocations: {
            include: {
              nodeModifier: true,
            },
          },
        },
      },
      defender: true,
      attacker: true,
      prefightChampions: {
        include: {
          champion: true,
        },
      },
    },
    orderBy: {
      node: {
        nodeNumber: "asc",
      },
    },
  });

  const targetNodeOption = interaction.options.getString("node");
  let filteredFights = fights;
  if (targetNodeOption) {
    filteredFights = fights.filter(
      (f) => f.node.nodeNumber.toString() === targetNodeOption
    );
  }

  if (filteredFights.length === 0) {
    await interaction.editReply(
      targetNodeOption
        ? `No assignment for node '${targetNodeOption}'.`
        : `No assignments found for ${player.ingameName} in the current war.`
    );
    return;
  }

  // 5. Build Response
  const MAX_LENGTH = 3800;
  let components: TextDisplayBuilder[] = [];
  let currentLength = 0;
  let isFirstMessage = true;

  const sendContainer = async () => {
    if (components.length === 0) return;

    const container = new ContainerBuilder()
      .setAccentColor(bgColor)
      .addTextDisplayComponents(...components);

    if (isFirstMessage) {
      await interaction.editReply({
        components: [container],
        flags: [MessageFlags.IsComponentsV2],
      });
      isFirstMessage = false;
    } else {
      await interaction.followUp({
        components: [container],
        flags: [MessageFlags.IsComponentsV2],
      });
    }
  };

  const title = `**AW Details for ${capitalize(interaction.channel.name)}**`;
  components.push(new TextDisplayBuilder().setContent(title));
  currentLength += title.length;

  for (const fight of filteredFights) {
    const nodeNumber = fight.node.nodeNumber;
    const defenderName = fight.defender?.name || "Unknown";
    const defenderEmoji = await getEmoji(defenderName);

    const attackerName = fight.attacker?.name || "Any";
    const attackerEmoji = await getEmoji(attackerName);

    let assignmentText = `**Node ${nodeNumber}**\n`;
    assignmentText += `- ${attackerEmoji} **${attackerName}** vs ${defenderEmoji} **${defenderName}**`;

    // Add Prefights
    if (fight.prefightChampions.length > 0) {
      const prefightNames = await Promise.all(
        fight.prefightChampions.map(async (p) => {
          const emoji = await getEmoji(p.champion.name);
          return `${emoji} ${p.champion.name}`;
        })
      );
      assignmentText += ` (Prefight: ${prefightNames.join(", ")})`;
    }

    assignmentText += "\n";

    // Add Note if exists
    if (fight.notes) {
      assignmentText += `- Note: ${fight.notes}\n`;
    }

    // Add Node Details (Static + Modifiers)
    let nodeDetailsText = "";
    if (fight.node.description) {
      nodeDetailsText += `${fight.node.description}\n`;
    }

    // Filter and add modifiers
    const activeAllocations = fight.node.allocations.filter((a) => {
      // Check map type
      if (a.mapType !== war.mapType) return false;
      // Check season (if allocation has season, it must match)
      if (a.season !== null && a.season !== war.season) return false;
      // Check tier
      if (a.minTier !== null && war.warTier < a.minTier) return false;
      if (a.maxTier !== null && war.warTier > a.maxTier) return false;
      return true;
    });

    for (const alloc of activeAllocations) {
      nodeDetailsText += `\n**${alloc.nodeModifier.name}**: ${alloc.nodeModifier.description}`;
    }

    if (nodeDetailsText) {
      assignmentText += `\n**Node Details:**\n${nodeDetailsText}\n`;
    }

    if (currentLength + assignmentText.length > MAX_LENGTH) {
      await sendContainer();
      components = [
        new TextDisplayBuilder().setContent(
          `**AW Details for ${capitalize(interaction.channel.name)} (cont.)**`
        ),
      ];
      currentLength = components[0].toJSON().content.length;
    }

    components.push(new TextDisplayBuilder().setContent(assignmentText));
    currentLength += assignmentText.length;
  }

  if (components.length > 0) {
    await sendContainer();
  }
}