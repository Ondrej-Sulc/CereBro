import { NextResponse } from "next/server";
import { getChampionLookupOptions } from "@/lib/data/champion-lookup";
import logger from "@/lib/logger";

export async function GET() {
  try {
    return NextResponse.json(await getChampionLookupOptions(), {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=900" },
    });
  } catch (error) {
    logger.error({ err: error }, "Unable to load public champion lookup");
    return NextResponse.json({ error: "Champion search is unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
