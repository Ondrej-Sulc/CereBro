import { PostHog } from 'posthog-node';
import logger from './loggerService';

let posthogClient: PostHog | null = null;
let isInitialized = false;

export async function getPosthogClient(): Promise<PostHog | null> {
    if (!isInitialized) {
        isInitialized = true; // Set immediately to prevent race conditions
        try {
            const { config } = await import('../config.js');
            if (config.POSTHOG_API_KEY && config.POSTHOG_HOST) {
                posthogClient = new PostHog(config.POSTHOG_API_KEY, {
                    host: config.POSTHOG_HOST,
                    flushAt: 1,
                    flushInterval: 0
                });
                logger.info("✅ PostHog client initialized.");
            }
        } catch (e) {
            logger.error({ error: e }, "❌ Failed to initialize PostHog client");
            posthogClient = null;
        }
    }
    return posthogClient;
}