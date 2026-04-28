import { Client } from 'discord.js';
import { distributeWarPlan } from '../distribution/warPlanDistributor';
import logger from '../loggerService';

export async function handleDistributeWarPlan(client: Client, payload: any) {
    const { allianceId, warId, battlegroup, targetChannelId, targetPlayerId } = payload;
    
    if (!allianceId || !warId) {
        throw new Error("Missing allianceId or warId for plan distribution");
    }

    logger.info(`Starting plan distribution for war ${warId} (BG: ${battlegroup || 'All'}) ${targetPlayerId ? `to player ${targetPlayerId}` : ''} ${targetChannelId ? `to channel ${targetChannelId}` : ''}`);

    try {
        const result = await distributeWarPlan(client, allianceId, warId, battlegroup, targetPlayerId, targetChannelId);
        
        if (result.errors.length > 0) {
            throw new Error(`Errors during distribution: ${result.errors.join(', ')}`);
        }

        logger.info({ result }, "Distributed War Plan Result");
        return result;
    } catch (error) {
        logger.error({ error, allianceId, warId, battlegroup }, "Failed to distribute war plan");
        throw error;
    }
}
