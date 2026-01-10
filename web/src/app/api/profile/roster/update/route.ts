import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import logger from "@cerebro/core/services/loggerService";
import { NextRequest, NextResponse } from "next/server";
import { processRosterScreenshot } from "@cerebro/core/commands/roster/ocr/process";
import { RosterUpdateResult } from "@cerebro/core/commands/roster/ocr/types";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";

export const maxDuration = 60; // Allow 60 seconds for processing

export async function POST(req: NextRequest) {
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
    const stars = parseInt(formData.get("stars") as string);
    const rank = parseInt(formData.get("rank") as string);
    const isAscended = formData.get("isAscended") === "true";
    const files = formData.getAll("images") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    if (isNaN(stars) || isNaN(rank)) {
        return NextResponse.json({ error: "Invalid stars or rank" }, { status: 400 });
    }

    logger.info({ 
        playerId: player.id, 
        stars, 
        rank, 
        isAscended, 
        fileCount: files.length,
        fileNames: files.map(f => f.name)
    }, "Starting roster update via screenshot upload");

    const startTime = Date.now();
    let totalCount = 0;
    const errors: string[] = [];

    const allAdded = [];

    for (const file of files) {
      try {
        const fileStartTime = Date.now();
        const buffer = Buffer.from(await file.arrayBuffer());
        
        logger.info({ playerId: player.id, fileName: file.name, fileSize: buffer.length }, "Processing roster screenshot");

        // Call the core processing logic
        const result = await processRosterScreenshot(
          buffer,
          stars,
          rank,
          isAscended,
          false, // debugMode
          player.id
        );

        if ('champions' in result) {
            const updateResult = result as RosterUpdateResult;
            const added = updateResult.champions.flat();
            totalCount += added.length;
            allAdded.push(...added);
            logger.info({ 
                playerId: player.id, 
                fileName: file.name, 
                addedCount: added.length,
                duration: Date.now() - fileStartTime 
            }, "Successfully processed roster screenshot");
        }
      } catch (err: any) {
        logger.error({ 
            error: err.message, 
            stack: err.stack,
            playerId: player.id,
            fileName: file.name 
        }, "Error processing roster screenshot file");
        errors.push(`File ${file.name}: ${err.message || "Unknown error"}`);
      }
    }

    const duration = Date.now() - startTime;
    logger.info({ 
        playerId: player.id, 
        totalAdded: totalCount, 
        errorCount: errors.length,
        duration 
    }, "Completed roster update request");

    return NextResponse.json({ count: totalCount, added: allAdded, errors });

  } catch (err: any) {
    logger.error({ error: err }, "API Error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
