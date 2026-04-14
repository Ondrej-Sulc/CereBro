import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rosterImageService } from "@cerebro/core/services/rosterImageService";
import logger from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";

export const maxDuration = 60; // Allow longer timeout for processing

export const POST = withRouteContext(async (req: NextRequest) => {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const files = formData.getAll("images") as File[];

    if (files.length === 0) {
        return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    // 3. Process each file
    const results = await Promise.all(
        files.map(async (file) => {
            try {
                const bytes = await file.arrayBuffer();
                const buffer = Buffer.from(bytes);
                const { grid, debugImage } = await rosterImageService.processBGView(buffer, { debugMode: true });
                return {
                    fileName: file.name,
                    debug: debugImage ? debugImage.toString("base64") : "",
                    success: true,
                    grid,
                };
            } catch (error) {
                logger.error({ err: error, fileName: file.name }, "Error processing file in debug-roster API");
                return {
                    fileName: file.name,
                    debug: "",
                    success: false,
                    error: error instanceof Error ? error.message : "Failed to process image",
                };
            }
        })
    );

    return NextResponse.json({ results });
});
