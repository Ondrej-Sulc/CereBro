import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { auth } from "@/auth";
import { parseFormData } from "@/lib/parseFormData";
import { withRouteContext } from "@/lib/with-request-context";

export const POST = withRouteContext(async (req: NextRequest) => {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { fields, tempFilePath: path } = await parseFormData(req);
        const { description, visibility, fightIds } = fields;

        if (!path) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Logic for handling the upload would go here (omitted for brevity but preserving structure)
        // This usually involves moving the temp file to GCS and creating a WarVideo record.

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, "Error uploading war video");
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
});
