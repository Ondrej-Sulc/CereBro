import { ArtworkError, assetId } from "./contract";
import { artworkLibrary } from "./storage";
export function artworkFailure(error: unknown) {
  const status = error instanceof ArtworkError ? error.status : 503;
  const message = error instanceof ArtworkError ? error.message : "The artwork library is temporarily unavailable.";
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
let streams = 0;
export async function artworkFile(request: Request, id: string, variant: "preview" | "original") {
  let release: (() => void) | undefined;
  try {
    assetId(id);
    if (streams >= 32) throw new ArtworkError(429, "Too many image requests. Try again shortly.");
    streams++;
    let released = false;
    release = () => { if (!released) { released = true; streams--; } };
    const file = await artworkLibrary().file(id, variant);
    const headers = new Headers({ "Content-Type": file.mime, "Content-Length": String(file.size), "ETag": file.etag,
      "Cache-Control": "public, max-age=3600, must-revalidate", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${file.filename}"` });
    if (request.headers.get("if-none-match")?.split(/,\s*/).some(value => value.replace(/^W\//, "") === file.etag || value === "*")) {
      await file.handle.close(); release(); headers.delete("Content-Length"); return new Response(null, { status: 304, headers });
    }
    if (request.method === "HEAD") { await file.handle.close(); release(); return new Response(null, { headers }); }
    const stream = file.handle.createReadStream({ autoClose: true, highWaterMark: 64 * 1024 });
    const closed = new Promise<void>(resolve => stream.once("close", () => { release?.(); resolve(); }));
    const abort = () => stream.destroy();
    request.signal.addEventListener("abort", abort, { once: true });
    stream.once("close", () => request.signal.removeEventListener("abort", abort));
    if (request.signal.aborted) abort();
    const iterator = stream[Symbol.asyncIterator]();
    return new Response(new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await iterator.next();
          if (chunk.done) controller.close(); else controller.enqueue(chunk.value);
        } catch (error) { controller.error(error); }
      },
      async cancel() { stream.destroy(); await closed; },
    }, {
      highWaterMark: 64 * 1024,
      size: (chunk: Uint8Array) => chunk.byteLength,
    }), { headers });
  } catch (error) { release?.(); return artworkFailure(error); }
}
