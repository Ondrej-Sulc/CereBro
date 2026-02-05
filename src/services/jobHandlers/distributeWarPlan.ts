import { Client } from 'discord.js';
import { distributeWarPlan } from '../distribution/warPlanDistributor';
import logger from '../loggerService';

export async function handleDistributeWarPlan(client: Client, payload: any) {
    const { allianceId, warId, battlegroup, targetChannelId } = payload;
    
    if (!allianceId || !warId) {
        throw new Error("Missing allianceId or warId for plan distribution");
    }

    logger.info(`Starting plan distribution for war ${warId} (BG: ${battlegroup || 'All'}) ${targetChannelId ? `to channel ${targetChannelId}` : ''}`);

    try {
        const result = await distributeWarPlan(client, allianceId, warId, battlegroup, undefined, targetChannelId);
        logger.info({ result }, "Distributed War Plan Result");
    } catch (error) {
        logger.error({ error, allianceId, warId, battlegroup }, "Failed to distribute war plan");
        throw error;
    }
}
