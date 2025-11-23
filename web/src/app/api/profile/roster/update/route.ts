import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { processRosterScreenshot } from "@cerebro/core/commands/roster/ocr/process";
import { RosterUpdateResult } from "@cerebro/core/commands/roster/ocr/types";

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

    const player = await prisma.player.findFirst({
      where: { discordId: account.providerAccountId, isActive: true },
    });

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

    let totalCount = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Call the core processing logic
        // processRosterScreenshot throws on error
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
        } else if ('message' in result) {
            // Should not happen if debugMode is false, but just in case
            console.log("Roster process returned message:", result.message);
        }

      } catch (err: any) {
        console.error(`Error processing file ${file.name}:`, err);
        errors.push(`File ${file.name}: ${err.message || "Unknown error"}`);
      }
    }

    return NextResponse.json({ count: totalCount, errors });

  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
