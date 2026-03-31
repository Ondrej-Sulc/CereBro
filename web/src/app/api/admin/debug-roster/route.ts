import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rosterImageService } from "@cerebro/core/services/rosterImageService";
import { processBGViewScreenshot } from "@cerebro/core/commands/roster/ocr/process";
import logger from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";

export const maxDuration = 60; // Allow longer timeout for processing

export const POST = withRouteContext(async (req: NextRequest) => {
    try {
        // 1. Auth Check
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Use BotUser for admin check
        const botUser = session.user.discordId
            ? await prisma.botUser.findUnique({
                where: { discordId: session.user.discordId }
              })
            : null;

        if (!botUser?.isBotAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 2. Parse FormData
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const type = formData.get("type") as string; // 'roster' or 'bg'

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        let result;
        if (type === 'bg') {
            result = await processBGViewScreenshot(buffer);
        } else {
             const { grid } = await rosterImageService.processBGView(buffer);
             result = { grid };
        }

        return NextResponse.json({
            success: true,
            ...result
        });

    } catch (error) {
        logger.error({ err: error }, "Error in debug-roster API");
        return NextResponse.json({ error: "Failed to process image" }, { status: 500 });
    }
});
