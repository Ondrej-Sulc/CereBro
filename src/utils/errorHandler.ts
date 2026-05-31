import {
  ChatInputCommandInteraction,
  MessageFlags,
  RepliableInteraction, // Import RepliableInteraction directly
} from "discord.js";
import { randomBytes } from "crypto";
import logger from "../services/loggerService";
import { getPosthogClient } from "../services/posthogService";

// Removed custom RepliableInteraction type definition

export interface ErrorContext {
  location?: string; // e.g., command name, service name
  userId?: string;
  extra?: Record<string, any>;
}

export function generateErrorId() {
  /**
   * Generates a random error ID.
   * @returns A random error ID string.
   */
  return randomBytes(4).toString("hex");
}

function getDiscordErrorCode(error: unknown): string | number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  return (error as { code?: string | number }).code;
}

export function isIgnorableInteractionLifecycleError(error: unknown): boolean {
  const code = getDiscordErrorCode(error);
  if (code === 10062 || code === "10062" || code === 40060 || code === "40060") {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("DiscordAPIError[10062]") ||
    message.includes("DiscordAPIError[40060]") ||
    message.includes("Unknown interaction") ||
    message.includes("Interaction has already been acknowledged")
  );
}

/**
 * Extracts all properties from an Error object for better logging.
 * @param error - The error to process.
 * @returns A plain object with all of the error's properties.
 */
function getErrorProperties(error: unknown) {
  if (!(error instanceof Error)) {
    return error;
  }
  const plainObject: Record<string, any> = {};
  Object.getOwnPropertyNames(error).forEach((key) => {
    plainObject[key] = (error as any)[key];
  });
  return plainObject;
}

export function handleError(error: unknown, context: ErrorContext = {}) {
  /**
   * Handles an error by logging it and generating a user-friendly error message.
   * @param error - The error to handle.
   * @param context - The context in which the error occurred.
   * @returns An object containing the user-friendly error message and the error ID.
   */
  const errorId = generateErrorId();
  const errorObj = error instanceof Error ? error : new Error(String(error));

  const logContext = {
    errorId,
    ...context,
    error: errorObj.message,
    rawError: getErrorProperties(errorObj), // Log the full error object for more details
  };

  const shouldReport = !isIgnorableInteractionLifecycleError(error);

  if (shouldReport) {
    logger.error(logContext, `[Error:${errorId}]`);
  } else {
    logger.warn(logContext, `[IgnoredInteractionError:${errorId}]`);
  }

  // --- PostHog Event Capture ---
  if (shouldReport) {
    (async () => {
      try {
        const posthogClient = await getPosthogClient();
        if (posthogClient && context.userId) {
          posthogClient.capture({
            distinctId: context.userId,
            event: "error_occurred",
            properties: {
              error_id: errorId,
              error_name: errorObj.name,
              error_message: errorObj.message,
              error_stack: errorObj.stack,
              location: context.location,
              ...context.extra,
            },
          });
        }
      } catch (e) {
        logger.error({ err: e }, "Failed to capture PostHog error event");
      }
    })();
  }
  // -----------------------------

  // More professional user-facing message
  const userMessage =
    `❌ An unexpected error occurred. Our team has been notified. ` +
    `Please try again later. (Error ID: ${errorId})`;

  return { userMessage, errorId };
}

export async function safeReply(
  /**
   * Safely replies to an interaction, handling deferred and replied states.
   * @param interaction - The interaction to reply to.
   * @param userMessage - The message to send to the user.
   * @param errorId - The ID of the error, if any.
   */
  interaction: RepliableInteraction,
  userMessage: string,
  errorId?: string
) {
  const content = userMessage;
  try {
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content });
      } else {
        await interaction.reply({ content, flags: [MessageFlags.Ephemeral] });
      }
    }
  } catch (err) {
    const replyLogContext = {
      err,
      interactionId: interaction.id,
      interactionType: interaction.type,
    };
    if (isIgnorableInteractionLifecycleError(err)) {
      logger.debug(replyLogContext, `[safeReply] Ignored expired interaction reply`);
    } else {
      logger.error(replyLogContext, `[safeReply] Failed to reply to interaction`);
    }
  }
}
