import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  download: vi.fn(),
  file: vi.fn(),
}));
vi.mock("../config", () => ({
  config: {
    GOOGLE_CREDENTIALS: {
      client_email: "test",
      private_key: "test",
      project_id: "test",
    },
    GCS_BUCKET_NAME: "test-images",
  },
}));
vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    bucket() {
      return { file: mocks.file };
    }
  },
}));
import { gcpStorageService } from "./gcpStorageService";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.file.mockReturnValue({ save: mocks.save, download: mocks.download });
});

describe("immutable image uploads to the champion image bucket", () => {
  it("creates a cached PNG without overwriting an existing object", async () => {
    const bytes = Buffer.from("image");
    const url = await gcpStorageService.uploadImmutableBuffer(
      bytes,
      "relics/portrait/hash.png",
      "image/png",
    );
    expect(url).toBe(
      "https://storage.googleapis.com/test-images/relics/portrait/hash.png",
    );
    expect(mocks.save).toHaveBeenCalledWith(bytes, {
      contentType: "image/png",
      metadata: { cacheControl: "public, max-age=31536000, immutable" },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  });
  it("reuses an existing object only when its bytes match", async () => {
    mocks.save.mockRejectedValue({ code: 412 });
    mocks.download.mockResolvedValue([Buffer.from("image")]);
    await expect(
      gcpStorageService.uploadImmutableBuffer(
        Buffer.from("image"),
        "relics/p/hash.png",
        "image/png",
      ),
    ).resolves.toContain("/relics/p/hash.png");
    mocks.download.mockResolvedValue([Buffer.from("different")]);
    await expect(
      gcpStorageService.uploadImmutableBuffer(
        Buffer.from("image"),
        "relics/p/hash.png",
        "image/png",
      ),
    ).rejects.toThrow(/different bytes/);
  });
  it("does not mistake a permission failure for an existing image", async () => {
    const denied = Object.assign(new Error("permission denied"), { code: 403 });
    mocks.save.mockRejectedValue(denied);
    await expect(
      gcpStorageService.uploadImmutableBuffer(
        Buffer.from("image"),
        "relics/p/hash.png",
        "image/png",
      ),
    ).rejects.toBe(denied);
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
