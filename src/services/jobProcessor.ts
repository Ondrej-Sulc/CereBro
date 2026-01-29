import { Client } from 'discord.js';
import { prisma } from './prismaService';
import logger from './loggerService';
import { handleWarVideoNotification } from './jobHandlers/warVideoNotification';
import { handleDeathVideoNotification } from './jobHandlers/deathVideoNotification';
import { handleDistributeWarPlan } from './jobHandlers/distributeWarPlan';
import { handleDistributeDefensePlan } from './jobHandlers/distributeDefensePlan';
import { handleUpdateMemberRoles } from './jobHandlers/updateMemberRoles';
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
          case 'NOTIFY_WAR_VIDEO':
            await handleWarVideoNotification(client, job.payload);
            break;
          case 'NOTIFY_DEATH_VIDEO':
            await handleDeathVideoNotification(client, job.payload);
            break;
                          case 'DISTRIBUTE_WAR_PLAN':
                              await handleDistributeWarPlan(client, job.payload);
                              break;
                          case 'DISTRIBUTE_DEFENSE_PLAN':
                              await handleDistributeDefensePlan(client, job.payload);
                              break;
                          case 'UPDATE_MEMBER_ROLES':            await handleUpdateMemberRoles(client, job.payload);
            break;
          default:
            logger.warn(`Unknown job type: ${job.type}`);
        }

        await prisma.botJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED' }
        });
      } catch (error: any) {
        logger.error({ error: String(error), jobId: job.id }, 'Job processing failed');
        await prisma.botJob.update({
          where: { id: job.id },
          data: { 
            status: 'FAILED',
            error: error.message || String(error)
          }
        });
      }

    } catch (error) {
      logger.error({ error: String(error) }, 'Error in Job Processor loop');
    }
  }, 5000); // Poll every 5 seconds
}
