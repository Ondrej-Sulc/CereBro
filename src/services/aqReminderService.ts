import { Client, TextChannel } from "discord.js";
import { DateTime } from "luxon";
import cron from "node-cron";
import { config } from "../config";
import { AQState, getAllStates, setState } from "../commands/aq/state";
import { prisma } from "./prismaService";
import logger from "./loggerService";

function getSlackers(
  state: AQState,
  isFinal: boolean,
  isSection2: boolean
): string[] {
  const slackers: Set<string> = new Set();
  let sectionsToCheck: ("s1" | "s2" | "s3")[] = ["s1"];
  if (isFinal) {
    sectionsToCheck = ["s1", "s2", "s3"];
  } else if (isSection2) {
    sectionsToCheck = ["s1", "s2"];
  }

  for (const section of sectionsToCheck) {
    if (state.players[section]) {
      for (const playerId in state.players[section]) {
        if (!state.players[section][playerId].done) {
          slackers.add(`<@${playerId}>`);
        }
      }
    }
  }
  return Array.from(slackers);
}

async function sendReminderPing(
  client: Client,
  state: AQState,
  isFinal: boolean,
  isSection2: boolean
) {
  const slackers = getSlackers(state, isFinal, isSection2);
  if (slackers.length === 0) return;

  let message = `Friendly reminder to move in AQ: ${slackers.join(" ")}`;
  if (isFinal) {
    message = `🚨 Final push! Map not complete. Please clear your paths: ${slackers.join(
      " "
    )}`;
  } else if (isSection2) {
    message = `Reminder to clear section 2 in AQ: ${slackers.join(" ")}`;
  }

  try {
    const channel = await client.channels.fetch(state.channelId);
    if (channel && channel.isTextBased()) {
      await (channel as TextChannel).send(message);
    }
  } catch (error) {
    logger.error(
      { error, channelId: state.channelId },
      `[AQReminder] Failed to send AQ reminder to channel ${state.channelId}`
    );
  }
}

async function checkAqStatuses(client: Client) {
  const allStates = await getAllStates();
  const now = DateTime.utc();

  for (const state of allStates) {
    if (state.status !== "active") continue;

    let allianceId = state.allianceId;
    if (!allianceId) {
      const schedule = await prisma.aQSchedule.findFirst({
        where: { channelId: state.channelId },
      });
      if (schedule) {
        allianceId = schedule.allianceId;
      }
    }

    if (!allianceId) continue;

    const alliance = await prisma.alliance.findUnique({
      where: { id: allianceId },
      include: { aqReminderSettings: true },
    });

    if (!alliance) continue;

    const { aqReminderSettings } = alliance;

    if (!aqReminderSettings) continue;

    let stateNeedsSaving = false;
    let startTime: DateTime;
    if (state.startTimeIso) {
      startTime = DateTime.fromISO(state.startTimeIso);
    } else {
      startTime = now;
      state.startTimeIso = now.toISO();
      stateNeedsSaving = true;
    }

    // Section 1 ping
    if (aqReminderSettings.section1ReminderEnabled) {
      const [hour, minute] = aqReminderSettings.section1PingTime
        .split(":")
        .map(Number);
      let section1PingTime = startTime.set({
        hour,
        minute,
        second: 0,
        millisecond: 0,
      });
      if (section1PingTime < startTime) {
        section1PingTime = section1PingTime.plus({ days: 1 });
      }
      if (!state.slackerPingSent && now >= section1PingTime) {
        await sendReminderPing(client, state, false, false);
        state.slackerPingSent = true;
        stateNeedsSaving = true;
      }
    }

    // Section 2 ping
    if (aqReminderSettings.section2ReminderEnabled) {
      const [hour, minute] = aqReminderSettings.section2PingTime
        .split(":")
        .map(Number);
      let section2PingTime = startTime.set({
        hour,
        minute,
        second: 0,
        millisecond: 0,
      });
      if (section2PingTime < startTime) {
        section2PingTime = section2PingTime.plus({ days: 1 });
      }
      if (!state.section2PingSent && now >= section2PingTime) {
        await sendReminderPing(client, state, false, true);
        state.section2PingSent = true;
        stateNeedsSaving = true;
      }
    }

    // Final ping
    if (aqReminderSettings.finalReminderEnabled) {
      const [hour, minute] = aqReminderSettings.finalPingTime
        .split(":")
        .map(Number);
      let finalPingTime = startTime.set({
        hour,
        minute,
        second: 0,
        millisecond: 0,
      });
      if (finalPingTime < startTime) {
        finalPingTime = finalPingTime.plus({ days: 1 });
      }
      if (!state.finalPingSent && now >= finalPingTime) {
        await sendReminderPing(client, state, true, false);
        state.finalPingSent = true;
        stateNeedsSaving = true;
      }
    }

    if (stateNeedsSaving) {
      await setState(state.channelId, state);
    }
  }
}

export function initializeAqReminders(client: Client) {
  // Run every 5 minutes
  cron.schedule("*/5 * * * *", () => checkAqStatuses(client), {
    timezone: config.TIMEZONE,
  });
  logger.info("[AQReminder] Service initialized.");
}
