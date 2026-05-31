import {
  Guild,
  GuildBasedChannel,
  MessageFlags,
  AttachmentBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { CommandResult } from "../../types/command";
import { AQState, getState, setState } from "./state";
import { generateAQHeader } from "./header";
import { buildAQContainer } from "./view";
import { prisma } from "../../services/prismaService";
import logger from "../../services/loggerService";
import { getActivePlayer } from "../../utils/playerHelper";

interface AQCoreStartParams {
  day: number;
  battlegroup: number;
  pingRoleId: string | null;
  channel: GuildBasedChannel;
  guild: Guild;
  channelName: string;
  battlegroupName: string;
  userId?: string;
}

function isDiscordMissingAccessError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: number | string }).code;
  return (
    code === 50001 ||
    code === "50001" ||
    code === 50013 ||
    code === "50013"
  );
}

function getCannotSendMessage(channelName: string): string {
  return `I don't have permission to send AQ tracker messages in **${channelName}**. Please grant me permission to view and send messages there, then try again.`;
}

function canSendTrackerMessage(channel: GuildBasedChannel, guild: Guild): boolean {
  const botMember = guild.members.me;
  if (!botMember || typeof channel.permissionsFor !== "function") {
    return true;
  }

  const permissions = channel.permissionsFor(botMember);
  if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
    return false;
  }

  const sendPermission = channel.isThread()
    ? PermissionFlagsBits.SendMessagesInThreads
    : PermissionFlagsBits.SendMessages;
  return (
    permissions.has(sendPermission) &&
    permissions.has(PermissionFlagsBits.AttachFiles)
  );
}

export async function handleStart(
  params: AQCoreStartParams
): Promise<CommandResult> {
  const { day, battlegroup, pingRoleId, channel, guild, channelName, battlegroupName, userId } = params;

  if (!("send" in channel)) {
    return {
      flags: MessageFlags.Ephemeral,
    };
  }

  if (!canSendTrackerMessage(channel, guild)) {
    return {
      content: getCannotSendMessage(channelName),
      flags: MessageFlags.Ephemeral,
    };
  }

  const activePlayer = userId ? await getActivePlayer(userId) : null;
  const allianceWhere =
    activePlayer?.allianceId && activePlayer.alliance?.guildId === guild.id
      ? { id: activePlayer.allianceId }
      : { guildId: guild.id };

  const alliance = await prisma.alliance.findFirst({
    where: allianceWhere,
  });
  if (!alliance) {
    return {
      content: "This server is not registered as an alliance.",
      flags: MessageFlags.Ephemeral,
    };
  }

  const channelId = channel.id;
  const existing = await getState(channelId);
  if (existing && existing.status === "active") {
    return {
      content: "An AQ tracker is already active in that channel.",
      flags: MessageFlags.Ephemeral,
    };
  }

  const players = await prisma.player.findMany({
    where: {
      allianceId: alliance.id,
      battlegroup: battlegroup,
    },
  });

  if (players.length === 0) {
    return {
      content: `There are no players registered in the database for ${battlegroupName}. Please sync your roles with \`/alliance sync-roles\`.`,
      flags: MessageFlags.Ephemeral,
    };
  }

  // Determine the role to use for pings
  let roleIdForPings: string | null = pingRoleId;
  if (!roleIdForPings) {
    switch (battlegroup) {
      case 1:
        roleIdForPings = alliance.battlegroup1Role;
        break;
      case 2:
        roleIdForPings = alliance.battlegroup2Role;
        break;
      case 3:
        roleIdForPings = alliance.battlegroup3Role;
        break;
    }
  }

  const now = new Date();
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 1000 * 600); // 24 hours minus 10 minutes

  const state: AQState = {
    channelId,
    messageId: "",
    roleId: roleIdForPings,
    day,
    status: "active",
    mapStatus: "Section 1 in Progress",
    players: { s1: {}, s2: {}, s3: {} },
    startTimeIso: now.toISOString(),
    endTimeIso: end.toISOString(),
    slackerPingSent: false,
    section2PingSent: false,
    finalPingSent: false,
    allianceId: alliance.id,
  };

  for (const player of players) {
    state.players.s1[player.discordId] = { done: false };
    state.players.s2[player.discordId] = { done: false };
    state.players.s3[player.discordId] = { done: false };
  }

  const headerImage = await generateAQHeader({
    day,
    channelName,
    battlegroupName,
  });

  const container = buildAQContainer(state, channelName, battlegroupName);
  const file = new AttachmentBuilder(headerImage).setName("aq_header.png");
  let sent;
  try {
    sent = await (channel as any).send({
      components: [container],
      files: [file],
      flags: [MessageFlags.IsComponentsV2],
    });
  } catch (error) {
    if (isDiscordMissingAccessError(error)) {
      logger.warn(
        { err: error, guildId: guild.id, channelId },
        "Cannot start AQ tracker without channel send access"
      );
      return {
        content: getCannotSendMessage(channelName),
        flags: MessageFlags.Ephemeral,
      };
    }

    throw error;
  }
  state.messageId = sent.id;

  if (alliance.createAqThread) {
    try {
      const thread = await sent.startThread({
        name: `AQ Day ${day} - ${battlegroupName} Updates`,
        autoArchiveDuration: 1440, // 24 hours
      });
      state.threadId = thread.id;
    } catch (error) {
      logger.error({ err: error, guildId: guild.id }, 'Failed to create AQ thread');
      if (isDiscordMissingAccessError(error)) {
        try {
          await (channel as any).send("I tried to start a thread for AQ updates, but I don't have the required 'Create Public Threads' permission. Please grant it to me if you'd like this feature enabled.");
        } catch (sendMessageError) {
          logger.error({ err: sendMessageError, guildId: guild.id }, 'Failed to send "missing permissions" message for thread creation');
        }
      }
    }
  }

  await setState(channelId, state);

  return {
    content: "AQ Tracker started successfully.",
    flags: MessageFlags.Ephemeral,
  };
}
