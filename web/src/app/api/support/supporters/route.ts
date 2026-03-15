import { NextResponse } from "next/server";
import logger from "@/lib/logger";
import { listPublicSupporters } from "@/lib/support-donations";

export async function GET(): Promise<NextResponse> {
  try {
    const supporters = await listPublicSupporters();
    return NextResponse.json(
      { supporters },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    logger.error({ error }, "Failed to load supporter list");
    return NextResponse.json(
      { error: "Unable to load supporters right now." },
      { status: 500 },
    );
  }
}
