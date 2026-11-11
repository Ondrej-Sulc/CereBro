import { artworkLibrary } from "@/lib/game-artwork/storage";
import { artworkFailure } from "@/lib/game-artwork/http";
import { assetId } from "@/lib/game-artwork/contract";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const id = assetId((await context.params).id); return Response.json(artworkLibrary().detail(id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return artworkFailure(error); }
}
