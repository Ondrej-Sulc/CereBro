import { gameIconSourceUrl } from "@/lib/game-icon-url";

export const runtime = "nodejs";
const MAX_ICON_BYTES = 512 * 1024;
const failure = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

async function readIcon(response: Response): Promise<ArrayBuffer | null> {
  const length = Number(response.headers.get("content-length"));
  if (length > MAX_ICON_BYTES) { await response.body?.cancel().catch(() => {}); return null; }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ICON_BYTES) return null;
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!size) return null;
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

export async function GET(_request: Request, { params }: { params: Promise<{ family: string; file: string }> }) {
  const { family, file } = await params;
  const source = gameIconSourceUrl(family, file);
  if (!source) return failure(404);
  try {
    const upstream = await fetch(source, {
      cache: "no-store", redirect: "error", credentials: "omit",
      headers: { Accept: "image/svg+xml" }, signal: AbortSignal.timeout(7000),
    });
    if (!upstream.ok) { await upstream.body?.cancel().catch(() => {}); return failure(upstream.status === 404 ? 404 : 502); }
    if (upstream.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/svg+xml") { await upstream.body?.cancel().catch(() => {}); return failure(502); }
    const bytes = await readIcon(upstream);
    if (!bytes) return failure(502);
    return new Response(bytes, { headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return failure(502);
  }
}
