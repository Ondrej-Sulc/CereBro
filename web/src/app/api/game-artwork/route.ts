import { parseFilters } from "@/lib/game-artwork/contract";
import { artworkLibrary } from "@/lib/game-artwork/storage";
import { artworkFailure } from "@/lib/game-artwork/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  try { const filters = parseFilters(new URL(request.url).searchParams); return Response.json(artworkLibrary().search(filters), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return artworkFailure(error); }
}
