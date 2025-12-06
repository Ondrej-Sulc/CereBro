import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { prisma } from './prismaService';
import logger from './loggerService';
import { config } from '../config';
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
            await processNotifyWarVideo(client, job.payload);
            break;
          // Future cases here
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

async function processNotifyWarVideo(client: Client, payload: any) {
    const { channelId, videoId, title, description, uploaderName, season, warNumber } = payload;
    
    if (!channelId || !videoId || !title || !uploaderName) {
        throw new Error("Invalid payload: Missing required fields");
    }

    try {
        const channel = await client.channels.fetch(channelId) as TextChannel;
        if (!channel) {
             throw new Error(`Channel ${channelId} not found`);
        }
        if (!channel.isTextBased()) {
            throw new Error(`Channel ${channelId} is not text-based`);
        }

        const videoPageUrl = `${config.botBaseUrl}/war-videos/${videoId}`;
        
        let warDisplay = `S${season}`;
        if (warNumber && warNumber !== 0) {
            warDisplay += ` W${warNumber}`;
        } else {
            warDisplay += ` (Offseason)`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🎥 New War Video Uploaded')
            .setDescription(`**[${title}](${videoPageUrl})**\n\n${description || ''}`)
            .setColor(0x0ea5e9) // Sky 500
            .addFields(
                { name: 'Uploader', value: uploaderName, inline: true },
                { name: 'War', value: warDisplay, inline: true }
            )
            .setFooter({ text: 'Click the title to watch and view fight details.' });

        await channel.send({ embeds: [embed] });
    } catch (e: any) {
        if (e.code === 50001) { // Missing Access
             throw new Error(`Bot missing access to channel ${channelId}`);
        }
        throw e;
    }
}
