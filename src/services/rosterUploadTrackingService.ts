import logger from "./loggerService.js";
import type { Prisma } from "@prisma/client";

export type RosterUploadSource = "web" | "discord";
export type RosterUploadMode = "bg-view" | "grid-view" | "stats-view";
export type RosterUploadStatus = "success" | "partial" | "failed";

export interface RecordRosterUploadEventInput {
  source: RosterUploadSource;
  mode: RosterUploadMode;
  actorPlayerId?: string | null;
  targetPlayerId?: string | null;
  actorBotUserId?: string | null;
  allianceId?: string | null;
  discordUserId?: string | null;
  fileCount: number;
  visionRequestCount?: number;
  processedChampionCount?: number;
  successCount?: number;
  errorCount?: number;
  durationMs?: number | null;
  errorMessages?: string[];
  metadata?: Prisma.InputJsonValue;
}

function getStatus(successCount: number, errorCount: number): RosterUploadStatus {
  if (successCount > 0 && errorCount === 0) return "success";
  if (successCount > 0 && errorCount > 0) return "partial";
  return "failed";
}

function truncateErrors(errors: string[] = []): string[] {
  return errors.map((error) => error.slice(0, 1000)).slice(0, 20);
}

export async function recordRosterUploadEvent(input: RecordRosterUploadEventInput): Promise<void> {
  try {
    const { prisma } = await import("./prismaService.js");
    const successCount = input.successCount ?? 0;
    const errorCount = input.errorCount ?? 0;

    await prisma.rosterUploadEvent.create({
      data: {
        source: input.source,
        mode: input.mode,
        status: getStatus(successCount, errorCount),
        actorPlayerId: input.actorPlayerId ?? null,
        targetPlayerId: input.targetPlayerId ?? null,
        actorBotUserId: input.actorBotUserId ?? null,
        allianceId: input.allianceId ?? null,
        discordUserId: input.discordUserId ?? null,
        fileCount: input.fileCount,
        visionRequestCount: input.visionRequestCount ?? input.fileCount,
        processedChampionCount: input.processedChampionCount ?? 0,
        successCount,
        errorCount,
        durationMs: input.durationMs ?? null,
        errorMessages: truncateErrors(input.errorMessages),
        metadata: input.metadata,
      },
    });
  } catch (error) {
    logger.error({ error, input }, "Failed to record roster upload usage event");
  }
}
