import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rosterImageService } from "@cerebro/core/services/rosterImageService";
import { processStatsViewScreenshot } from "@cerebro/core/commands/roster/ocr/process"; // Alternatively use this if easier, but direct service is better for debug
import logger from "@cerebro/core/services/loggerService";

export const maxDuration = 60; // Allow longer timeout for processing

export async function POST(req: NextRequest) {
    try {
        // 1. Auth Check
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { accounts: true }
        });
        
        const discordId = user?.accounts.find(a => a.provider === 'discord')?.providerAccountId;
        if (!discordId) {
            return NextResponse.json({ error: "No Discord account linked" }, { status: 403 });
        }

        const botUser = await prisma.botUser.findUnique({ where: { discordId } });
        if (!botUser?.isBotAdmin) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        // 2. Parse Files
        const formData = await req.formData();
        const files = formData.getAll("images") as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: "No images provided" }, { status: 400 });
        }

        const results: { original: string; debug: string }[] = [];

        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            
            try {
                // We use processStatsView directly to get the debug image
                const { debugImage } = await rosterImageService.processStatsView(buffer, { debugMode: true });
                
                if (debugImage) {
                    results.push({
                        original: file.name,
                        debug: debugImage.toString('base64')
                    });
                } else {
                    // Fallback if no debug image returned (shouldn't happen with debugMode: true)
                    results.push({
                        original: file.name,
                        debug: "" // Empty string or placeholder
                    });
                }
            } catch (err: any) {
                logger.error({ error: err, fileName: file.name }, "Error processing debug roster image");
                // Return error image or message?
                // For now, skip or push error
                continue;
            }
        }

        return NextResponse.json({ results });

    } catch (error: any) {
        logger.error({ error }, "Error in debug roster route");
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
