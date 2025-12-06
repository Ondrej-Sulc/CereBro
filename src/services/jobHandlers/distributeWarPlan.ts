import { Client } from 'discord.js';
import { distributeWarPlan } from '../distribution/warPlanDistributor';
import logger from '../loggerService';

export async function handleDistributeWarPlan(client: Client, payload: any) {
    const { allianceId, warId, battlegroup } = payload;
    
    if (!allianceId || !warId) {
        throw new Error("Missing allianceId or warId for plan distribution");
    }

    logger.info(`Starting plan distribution for war ${warId} (BG: ${battlegroup || 'All'})`);

    const result = await distributeWarPlan(client, allianceId, warId, battlegroup);
    
    logger.info({ result }, "Distributed War Plan Result");
}
