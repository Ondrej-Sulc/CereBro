import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const upstream = vi.fn<typeof fetch>();
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path fill="#fff" d="M0 0h40v40z"/></svg>';
const request = (family = "glossary-icons", file = "bulwark.svg") =>
  GET(new Request("http://localhost/api/game-icons/" + family + "/" + file), { params: Promise.resolve({ family, file }) });
beforeEach(() => { upstream.mockReset(); vi.stubGlobal("fetch", upstream); });
afterEach(() => vi.unstubAllGlobals());

describe("public native icon relay", () => {
  it("returns the exact SVG bytes from the fixed public origin, with safe image/cache headers", async () => {
    upstream.mockResolvedValue(new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } }));
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(svg);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("cache-control")).toContain("public");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(upstream).toHaveBeenCalledWith("https://storage.googleapis.com/champion-images/mcoc/glossary-icons/bulwark.svg",
      expect.objectContaining({ redirect: "error", credentials: "omit", signal: expect.any(AbortSignal) }));
  });
  it.each([["other", "fury.svg"], ["glossary-icons", "../secret.svg"], ["game-effect-icons", "%2fsecret.svg"]])(
    "rejects invalid paths before any upstream request", async (family, file) => {
      expect((await request(family, file)).status).toBe(404);
      expect(upstream).not.toHaveBeenCalled();
    });
  it.each([404, 403, 503])("does not cache an upstream %s failure", async status => {
    upstream.mockResolvedValue(new Response(null, { status }));
    const response = await request();
    expect(response.status).toBe(status === 404 ? 404 : 502);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects non-image responses instead of serving HTML from the app origin", async () => {
    upstream.mockResolvedValue(new Response("<html>not an icon</html>", { headers: { "Content-Type": "text/html" } }));
    expect((await request()).status).toBe(502);
  });
  it.each([true, false])("bounds declared and streamed response sizes (declared=%s)", async declared => {
    upstream.mockResolvedValue(new Response(new Uint8Array(512 * 1024 + 1), { headers: {
      "Content-Type": "image/svg+xml", ...(declared ? { "Content-Length": String(512 * 1024 + 1) } : {}),
    } }));
    expect((await request()).status).toBe(502);
  });
  it("handles connection failures without exposing upstream internals", async () => {
    upstream.mockRejectedValue(new Error("private transport detail"));
    const response = await request();
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private transport detail");
  });
});
