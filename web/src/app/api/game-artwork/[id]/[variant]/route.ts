import { artworkFile, artworkFailure } from "@/lib/game-artwork/http";
import { ArtworkError } from "@/lib/game-artwork/contract";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string; variant: string }> }) {
  const { id, variant } = await context.params;
  if (variant !== "preview" && variant !== "original") return artworkFailure(new ArtworkError(404, "Image not found."));
  return artworkFile(request, id, variant);
}
export const HEAD = GET;
