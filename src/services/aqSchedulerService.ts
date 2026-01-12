import cron from "node-cron";
import { prisma } from "./prismaService";
import { Client, TextChannel } from "discord.js";
import { handleStart } from "../commands/aq/start";
import logger from "../services/loggerService";

let isRunning = false;

export function startAQScheduler(client: Client) {
  if (isRunning) {
    logger.info("[AQScheduler] Already running.");
    return;
  }

  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const time = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;
  logger.info(`[AQScheduler] Starting scheduler. Server Time: ${time} UTC, Day: ${dayOfWeek}`);

  // Run every minute
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const time = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;

    try {
      const schedulesToRun = await prisma.aQSchedule.findMany({
        where: {
          dayOfWeek,
          time,
        },
        include: {
          alliance: {
            include: {
              aqSkip: true,
            },
          },
        },
      });

      if (schedulesToRun.length > 0) {
        logger.info(`[AQScheduler] Found ${schedulesToRun.length} schedules to run at Day ${dayOfWeek}, Time ${time} UTC.`);
      }

      for (const schedule of schedulesToRun) {
        const { alliance, aqDay, battlegroup, roleId, channelId } = schedule;

        if (alliance.aqSkip && alliance.aqSkip.skipUntil > now) {
          logger.info(`[AQScheduler] Skipping AQ for alliance ${alliance.name} (raid week).`);
          continue;
        }

        try {
          const channel = await client.channels.fetch(channelId);
          if (!channel || !(channel instanceof TextChannel)) {
            logger.error(`[AQScheduler] Channel ${channelId} not found or not a text channel for schedule ${schedule.id}.`);
            continue;
          }
          
          const guild = channel.guild;

          logger.info(`[AQScheduler] Running AQ start for ${alliance.name}, BG ${battlegroup}`);
          
          await handleStart({
            day: aqDay,
            battlegroup: battlegroup,
            pingRoleId: roleId, // The roleId from the schedule is the optional ping role
            channel: channel,
            guild: guild,
            channelName: channel.name,
            battlegroupName: `Battlegroup ${battlegroup}`,
          });

        } catch (error) {
          logger.error({error, scheduleId: schedule.id, allianceId: alliance.id}, `[AQScheduler] Error processing AQ start for alliance ${alliance.name}`);
        }
      }
    } catch (error) {
      logger.error({ error }, `[AQScheduler] Critical error querying schedules at ${time}`);
    }
  });

  isRunning = true;
  logger.info("[AQScheduler] Started.");
}
