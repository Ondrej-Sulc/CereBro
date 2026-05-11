import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { processRosterScreenshot, processBGViewScreenshot } from "@cerebro/core/commands/roster/ocr/process";
import { RosterUpdateResult } from "@cerebro/core/commands/roster/ocr/types";
import { recordRosterUploadEvent } from "@cerebro/core/services/rosterUploadTrackingService";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { withRouteContext } from "@/lib/with-request-context";
import { revalidatePath } from "next/cache";
import { clearCache } from "@/lib/cache";

export const maxDuration = 60; // Allow 60 seconds for processing

export const POST = withRouteContext(async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: "discord" },
    });

    if (!account?.providerAccountId) {
      return NextResponse.json({ error: "Discord account not found" }, { status: 404 });
    }

    const player = await getUserPlayerWithAlliance();

    if (!player) {
      return NextResponse.json({ error: "Player profile not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const mode = formData.get("mode") as string || "grid-view"; // Default to old 'grid-view'
    const stars = parseInt(formData.get("stars") as string);
    const rank = parseInt(formData.get("rank") as string);
    const isAscended = formData.get("isAscended") === "true";
    const ascensionLevel = parseInt(formData.get("ascensionLevel") as string) || 0;
    const files = formData.getAll("images") as File[];
    const targetPlayerIdRaw = formData.get("targetPlayerId") as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    if (mode === 'grid-view' && (isNaN(stars) || isNaN(rank))) {
        return NextResponse.json({ error: "Invalid stars or rank for Grid View" }, { status: 400 });
    }

    // Resolve effective player — officer/admin may upload on behalf of another player
    let effectivePlayerId = player.id;
    let effectiveAllianceId = player.allianceId;
    if (targetPlayerIdRaw && targetPlayerIdRaw !== player.id) {
      const targetPlayer = await prisma.player.findUnique({
        where: { id: targetPlayerIdRaw },
        select: { id: true, allianceId: true, ingameName: true },
      });
      if (!targetPlayer) {
        return NextResponse.json({ error: "Target player not found" }, { status: 404 });
      }
      const isOfficerSameAlliance =
        player.isOfficer &&
        player.allianceId !== null &&
        player.allianceId === targetPlayer.allianceId;
      if (!player.isBotAdmin && !isOfficerSameAlliance) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      logger.info(
        {
          actor: player.id,
          actorName: player.ingameName,
          target: targetPlayer.id,
          targetName: targetPlayer.ingameName,
          action: "upload",
          mode,
          fileCount: files.length,
        },
        "Officer/admin roster screenshot upload"
      );
      effectivePlayerId = targetPlayerIdRaw;
      effectiveAllianceId = targetPlayer.allianceId;
    }

    logger.info({
        playerId: effectivePlayerId,
        mode,
        stars,
        rank,
        isAscended,
        ascensionLevel,
        fileCount: files.length,
        fileNames: files.map(f => f.name)
    }, "Starting roster update via screenshot upload");

    const startTime = Date.now();
    let totalCount = 0;
    let successfulFiles = 0;
    const errors: string[] = [];

    const allAdded = [];

    for (const file of files) {
      try {
        const fileStartTime = Date.now();
        const buffer = Buffer.from(await file.arrayBuffer());
        
        logger.info({ playerId: effectivePlayerId, fileName: file.name, fileSize: buffer.length }, "Processing roster screenshot");

        // Call the core processing logic
        let result;

        if (mode === 'stats-view') {
             result = await processBGViewScreenshot(
                buffer,
                false, // debugMode
                effectivePlayerId
             );
        } else {
             result = await processRosterScreenshot(
                buffer,
                stars,
                rank,
                isAscended,
                ascensionLevel,
                false, // debugMode
                effectivePlayerId
             );
        }

        if ('champions' in result) {
            const updateResult = result as RosterUpdateResult;
            const added = updateResult.champions.flat();
            totalCount += added.length;
            allAdded.push(...added);
            successfulFiles++;
            if (updateResult.errors?.length) {
                errors.push(...updateResult.errors.map((error) => `File ${file.name}: ${error}`));
            }
            logger.info({
                playerId: effectivePlayerId,
                fileName: file.name,
                addedCount: added.length,
                duration: Date.now() - fileStartTime
            }, "Successfully processed roster screenshot");
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        logger.error({
            error: message,
            stack,
            playerId: effectivePlayerId,
            fileName: file.name
        }, "Error processing roster screenshot file");
        errors.push(`File ${file.name}: ${message || "Unknown error"}`);
      }
    }

    const duration = Date.now() - startTime;
    logger.info({
        playerId: effectivePlayerId,
        totalAdded: totalCount,
        errorCount: errors.length,
        duration
    }, "Completed roster update request");

    await recordRosterUploadEvent({
        source: "web",
        mode: mode === "stats-view" ? "stats-view" : "grid-view",
        actorPlayerId: player.id,
        targetPlayerId: effectivePlayerId,
        actorBotUserId: player.botUserId,
        allianceId: effectiveAllianceId,
        discordUserId: account.providerAccountId,
        fileCount: files.length,
        visionRequestCount: files.length,
        processedChampionCount: totalCount,
        successCount: successfulFiles,
        errorCount: errors.length,
        durationMs: duration,
        errorMessages: errors,
        metadata: {
            targetChanged: effectivePlayerId !== player.id,
            stars: Number.isNaN(stars) ? null : stars,
            rank: Number.isNaN(rank) ? null : rank,
            isAscended,
            ascensionLevel,
        },
    });

    // Invalidate caches
    revalidatePath("/profile/roster");
    if (effectivePlayerId !== player.id) {
        revalidatePath(`/player/${effectivePlayerId}/roster`);
    }
    if (player.allianceId) clearCache(`alliance-members-${player.allianceId}`);

    return NextResponse.json({ count: totalCount, added: allAdded, errors });

  } catch (err: unknown) {
    logger.error({ error: err }, "API Error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
