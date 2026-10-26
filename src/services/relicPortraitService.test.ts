import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  publishRelicPortraits,
  validateRelicPortraitUrls,
} from "./relicPortraitService";

const files: string[] = [];
afterEach(async () => {
  for (const file of files.splice(0)) await fs.unlink(file);
});
async function fixture() {
  const bytes = Buffer.from("verified portrait");
  const file = path.join(
    os.tmpdir(),
    `cerebro-relic-image-${randomUUID()}.png`,
  );
  files.push(file);
  await fs.writeFile(file, bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { bytes, asset: { name: "portrait", file, sha256 } };
}
const publicResponse = (bytes: Buffer) =>
  new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "image/png" },
  });

describe("verified relic portraits in shared cloud storage", () => {
  it("publishes source bytes to a relic-only hash path and verifies the public URL", async () => {
    const f = await fixture();
    const url = `https://storage.googleapis.com/test-images/relics/portrait/${f.asset.sha256}.png`;
    const storage = { uploadImmutableBuffer: vi.fn().mockResolvedValue(url) };
    const fetchImage = vi.fn().mockResolvedValue(publicResponse(f.bytes));
    const urls = await publishRelicPortraits(
      { assets: [f.asset] },
      storage,
      fetchImage,
    );
    expect(storage.uploadImmutableBuffer).toHaveBeenCalledWith(
      f.bytes,
      `relics/portrait/${f.asset.sha256}.png`,
      "image/png",
    );
    expect(urls).toEqual({ portrait: url });
    expect(fetchImage).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(() =>
      validateRelicPortraitUrls({ assets: [f.asset] }, urls),
    ).not.toThrow();
  });
  it("checks every local hash before publishing any image", async () => {
    const f = await fixture();
    const storage = { uploadImmutableBuffer: vi.fn() };
    const fetchImage = vi.fn();
    await expect(
      publishRelicPortraits(
        {
          assets: [
            f.asset,
            { ...f.asset, name: "other", sha256: "0".repeat(64) },
          ],
        },
        storage,
        fetchImage,
      ),
    ).rejects.toThrow(/changed after package validation/);
    expect(storage.uploadImmutableBuffer).not.toHaveBeenCalled();
  });
  it("refuses inaccessible or mismatched public content before returning database URLs", async () => {
    const f = await fixture();
    const url = `https://storage.googleapis.com/test-images/relics/portrait/${f.asset.sha256}.png`;
    const storage = { uploadImmutableBuffer: vi.fn().mockResolvedValue(url) };
    await expect(
      publishRelicPortraits(
        { assets: [f.asset] },
        storage,
        vi.fn().mockResolvedValue(new Response("denied", { status: 403 })),
      ),
    ).rejects.toThrow(/not publicly accessible/);
    await expect(
      publishRelicPortraits(
        { assets: [f.asset] },
        storage,
        vi.fn().mockResolvedValue(publicResponse(Buffer.from("wrong"))),
      ),
    ).rejects.toThrow(/hash mismatch/);
  });
  it("refuses missing, local and unrelated image references", async () => {
    const f = await fixture();
    const invalid: Record<string, string>[] = [
      {},
      { portrait: "/relics/portrait.png" },
      {
        portrait: "https://storage.googleapis.com/test-images/256/champion.png",
      },
    ];
    for (const urls of invalid) {
      expect(() =>
        validateRelicPortraitUrls({ assets: [f.asset] }, urls),
      ).toThrow(/portrait URL/);
    }
  });
});
