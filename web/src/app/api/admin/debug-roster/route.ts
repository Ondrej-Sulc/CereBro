import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rosterImageService } from "@cerebro/core/services/rosterImageService";
import { processBGViewScreenshot } from "@cerebro/core/commands/roster/ocr/process"; // Alternatively use this if easier, but direct service is better for debug
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
        const rawFiles = formData.getAll("images");
        const files = rawFiles.filter((f): f is File => f instanceof File);

        if (files.length === 0) {
            return NextResponse.json({ error: "No images provided" }, { status: 400 });
        }

        const results: { fileName: string; debug: string; success: boolean; error?: string }[] = [];

        for (const file of files) {
            try {
                if (!(file instanceof File)) {
                    throw new Error("Invalid file object provided");
                }

                const buffer = Buffer.from(await file.arrayBuffer());
                
                // We use processBGView directly to get the debug image
                const { debugImage } = await rosterImageService.processBGView(buffer, { debugMode: true });
                
                results.push({
                    fileName: file.name,
                    debug: debugImage ? debugImage.toString('base64') : "",
                    success: !!debugImage,
                    error: debugImage ? undefined : "No debug image generated"
                });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                const fileName = file instanceof File ? file.name : "unknown";
                logger.error({ error: err instanceof Error ? err : new Error(String(err)), fileName }, "Error processing debug roster image");
                
                results.push({
                    fileName,
                    debug: "",
                    success: false,
                    error: message
                });
            }
        }

        return NextResponse.json({ results });

    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error({ error: err }, "Error in debug roster route");
        return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
}
