import { Client } from 'discord.js';
import { distributeDefensePlan } from '../distribution/defensePlanDistributor';
import logger from '../loggerService';

export async function handleDistributeDefensePlan(client: Client, payload: any) {
    const { allianceId, battlegroup, planId, targetChannelId } = payload;
    
    if (!allianceId) {
        throw new Error("Missing allianceId in payload");
    }

    logger.info({ allianceId, battlegroup, planId, targetChannelId }, "Processing defense plan distribution job");

    try {
        const result = await distributeDefensePlan(client, allianceId, battlegroup, planId, targetChannelId);

        if (result.errors.length > 0) {
            throw new Error(`Errors during distribution: ${result.errors.join(', ')}`);
        }

        logger.info({ result }, "Defense plan distribution completed");
        return result;
    } catch (error) {
        logger.error({ error, allianceId, battlegroup, planId }, "Failed to distribute defense plan");
        throw error;
    }
}
