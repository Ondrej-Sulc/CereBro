import { Client } from 'discord.js';
import { prisma } from './prismaService';
import logger from './loggerService';
import { handleWarVideoNotification } from './jobHandlers/warVideoNotification';
import { handleDeathVideoNotification } from './jobHandlers/deathVideoNotification';
import { handleDistributeWarPlan } from './jobHandlers/distributeWarPlan';
import { handleDistributeDefensePlan } from './jobHandlers/distributeDefensePlan';
import { handleUpdateMemberRoles } from './jobHandlers/updateMemberRoles';
import { handleLeaveGuild } from './jobHandlers/leaveGuild';
// @ts-ignore - Types might be stale until regen
import { BotJobType, BotJobStatus } from '@prisma/client';

export function startJobProcessor(client: Client) {
  logger.info('⚙️ Job Processor started.');

  setInterval(async () => {
    try {
      if (!prisma.botJob) {
        logger.warn('⚠️ prisma.botJob is undefined. Waiting for client update...');
        return;
      }

      // Fetch one pending job at a time to avoid concurrency issues for now
      // (Can scale up later if needed)
      const job = await prisma.botJob.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' }
      });

      if (!job) return;

      // Lock the job
      await prisma.botJob.update({
        where: { id: job.id },
        data: { status: 'PROCESSING' }
      });

      logger.info(`Processing job ${job.id} (${job.type})`);

      try {
        switch (job.type) {
          case BotJobType.NOTIFY_WAR_VIDEO:
            await handleWarVideoNotification(client, job.payload);
            break;
          case BotJobType.NOTIFY_DEATH_VIDEO:
            await handleDeathVideoNotification(client, job.payload);
            break;
          case BotJobType.DISTRIBUTE_WAR_PLAN:
            await handleDistributeWarPlan(client, job.payload);
            break;
          case BotJobType.DISTRIBUTE_DEFENSE_PLAN:
            await handleDistributeDefensePlan(client, job.payload);
            break;
          case BotJobType.UPDATE_MEMBER_ROLES:
            await handleUpdateMemberRoles(client, job.payload);
            break;
          case BotJobType.LEAVE_GUILD:
            await handleLeaveGuild(client, job.payload as import('./jobHandlers/leaveGuild').LeaveGuildPayload);
            break;
          default:
            logger.warn(`Unknown job type: ${job.type}`);
        }

        await prisma.botJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED' }
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage, jobId: job.id }, 'Job processing failed');
        await prisma.botJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: errorMessage
          }
        });
      }

    } catch (error) {
      logger.error({ error: String(error) }, 'Error in Job Processor loop');
    }
  }, 5000); // Poll every 5 seconds
}
