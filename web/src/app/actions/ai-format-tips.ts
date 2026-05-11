"use server";

import { OpenRouterService, OpenRouterMessage } from "@cerebro/core/services/openRouterService";
import { withActionContext } from "@/lib/with-request-context";
import logger from "@/lib/logger";

export const autoFormatTipsAction = withActionContext('autoFormatTipsAction', async (rawTips: string): Promise<{ success: boolean; formattedTips?: string; error?: string }> => {
    if (!rawTips || rawTips.trim().length === 0) {
        return { success: false, error: "Tips are empty." };
    }

    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    const defaultModel = process.env.OPENROUTER_DEFAULT_MODEL || "liquid/lfm-40b";

    if (!apiKey) {
        return { success: false, error: "OpenRouter API Key not configured." };
    }

    try {
        const openRouterService = new OpenRouterService(apiKey);

        const systemMessage: OpenRouterMessage = {
            role: "system",
            content: "You are an assistant that formats Marvel Contest of Champions fight tips into a clean, concise, markdown list. Your output should ONLY contain the bulleted list. Do not include any conversational preamble, filler, or intro/outro text. Use markdown bullet points ('-'). Format key game terms (like buffs, debuffs, actions) in **bold** or *italics* where appropriate. If the input is already a list, just clean it up and ensure consistency. Do not change the underlying meaning."
        };

        const userMessage: OpenRouterMessage = {
            role: "user",
            content: `Please format these tips:

${rawTips}`
        };

        const response = await openRouterService.chat({
            model: defaultModel,
            messages: [systemMessage, userMessage],
            temperature: 0.3,
            max_tokens: 500,
        });

        if (
            response.choices &&
            Array.isArray(response.choices) &&
            response.choices.length > 0 &&
            response.choices[0].message &&
            typeof response.choices[0].message.content === "string" &&
            response.choices[0].message.content.trim().length > 0
        ) {
            const result = response.choices[0].message.content.trim();
            return { success: true, formattedTips: result };
        } else {
            return { success: false, error: "No response from AI." };
        }

    } catch (error: unknown) {
        logger.error({ err: error }, "Error auto-formatting tips");
        return { success: false, error: error instanceof Error ? error.message : "Failed to contact AI service." };
    }
});
