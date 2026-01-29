import { Client } from 'discord.js';
import { distributeDefensePlan } from '../distribution/defensePlanDistributor';
import logger from '../loggerService';

export async function handleDistributeDefensePlan(client: Client, payload: any) {
    const { allianceId, battlegroup } = payload;
    
    if (!allianceId) {
        throw new Error("Missing allianceId in payload");
    }

    logger.info({ allianceId, battlegroup }, "Processing defense plan distribution job");

    const result = await distributeDefensePlan(client, allianceId, battlegroup);

    if (result.errors.length > 0) {
        throw new Error(`Errors during distribution: ${result.errors.join(', ')}`);
    }

    logger.info({ result }, "Defense plan distribution completed");
    return result;
}
