import { beforeEach, describe, expect, it, vi } from "vitest";

const visionSdk = vi.hoisted(() => {
  const batchAnnotateImages = vi.fn(async () => [
    {
      responses: [
        {
          textAnnotations: [
            {
              description: "SDK result",
              boundingPoly: { vertices: [{ x: 1, y: 2 }] },
            },
          ],
        },
      ],
    },
  ]);
  const close = vi.fn(async () => undefined);
  const ImageAnnotatorClient = vi.fn(function ImageAnnotatorClient() {
    return { batchAnnotateImages, close };
  });

  return { ImageAnnotatorClient, batchAnnotateImages, close };
});

vi.mock("@google-cloud/vision", () => ({
  v1: {
    ImageAnnotatorClient: visionSdk.ImageAnnotatorClient,
  },
}));

vi.mock("./loggerService.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  createGoogleVisionClient,
  GoogleVisionCircuitOpenError,
  GoogleVisionService,
  type GoogleVisionClient,
  type GoogleVisionLogger,
  type VisionTextDetection,
} from "./googleVisionService.js";

describe("GoogleVisionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns OCR detections within the configured request deadline", async () => {
    const detections: VisionTextDetection[] = [
      {
        description: "12,345",
        boundingPoly: {
          vertices: [
            { x: 1, y: 2 },
            { x: 3, y: 2 },
            { x: 3, y: 4 },
            { x: 1, y: 4 },
          ],
        },
      },
    ];
    const detectText = vi.fn(async () => detections);
    const client: GoogleVisionClient = {
      detectText,
      close: vi.fn(async () => undefined),
    };
    const service = new GoogleVisionService({
      clientFactory: () => client,
      timeoutMs: 15_000,
    });
    const image = Buffer.from("screenshot");

    await expect(service.detectText(image)).resolves.toEqual(detections);
    expect(detectText).toHaveBeenCalledWith(image, 15_000);
  });

  it("uses the REST transport when creating the Google Vision client", () => {
    const credentials = {
      client_email: "vision@example.test",
      private_key: "private-key",
      project_id: "project-id",
    };

    createGoogleVisionClient(credentials, "rest");

    expect(visionSdk.ImageAnnotatorClient).toHaveBeenCalledWith({
      credentials,
      fallback: true,
    });
  });

  it("disables SDK retries and applies the deadline to text detection", async () => {
    const client = createGoogleVisionClient(
      {
        client_email: "vision@example.test",
        private_key: "private-key",
        project_id: "project-id",
      },
      "rest"
    );
    const image = Buffer.from("sdk screenshot");

    await expect(client.detectText(image, 15_000)).resolves.toEqual([
      {
        description: "SDK result",
        boundingPoly: { vertices: [{ x: 1, y: 2 }] },
      },
    ]);
    expect(visionSdk.batchAnnotateImages).toHaveBeenCalledWith(
      {
        requests: [
          {
            image: { content: image },
            features: [{ type: "TEXT_DETECTION" }],
          },
        ],
      },
      {
        timeout: 15_000,
        retry: null,
      }
    );
  });

  it("recovers from a timeout by retrying once with a fresh client", async () => {
    const timeoutError = Object.assign(new Error("Vision deadline exceeded"), {
      code: 4,
    });
    const detections: VisionTextDetection[] = [
      {
        description: "Recovered",
        boundingPoly: { vertices: [] },
      },
    ];
    const firstClient: GoogleVisionClient = {
      detectText: vi.fn(async () => {
        throw timeoutError;
      }),
      close: vi.fn(async () => undefined),
    };
    const secondClient: GoogleVisionClient = {
      detectText: vi.fn(async () => detections),
      close: vi.fn(async () => undefined),
    };
    const clientFactory = vi
      .fn<() => GoogleVisionClient>()
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient);
    const sleep = vi.fn(async () => undefined);
    const service = new GoogleVisionService({
      clientFactory,
      timeoutMs: 15_000,
      retryDelayMs: 100,
      retryJitterMs: 0,
      sleep,
    });

    await expect(service.detectText(Buffer.from("screenshot"))).resolves.toEqual(
      detections
    );
    expect(clientFactory).toHaveBeenCalledTimes(2);
    expect(firstClient.close).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it("does not retry a non-retryable Vision error", async () => {
    const invalidImageError = Object.assign(new Error("Invalid image"), {
      code: 3,
    });
    const client: GoogleVisionClient = {
      detectText: vi.fn(async () => {
        throw invalidImageError;
      }),
      close: vi.fn(async () => undefined),
    };
    const clientFactory = vi.fn(() => client);
    const sleep = vi.fn(async () => undefined);
    const service = new GoogleVisionService({
      clientFactory,
      sleep,
    });

    await expect(
      service.detectText(Buffer.from("invalid screenshot"))
    ).rejects.toBe(invalidImageError);
    expect(clientFactory).toHaveBeenCalledOnce();
    expect(client.close).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("fails fast while the Vision circuit breaker is cooling down", async () => {
    const timeoutError = Object.assign(new Error("Vision deadline exceeded"), {
      code: 4,
    });
    const firstClient: GoogleVisionClient = {
      detectText: vi.fn(async () => {
        throw timeoutError;
      }),
      close: vi.fn(async () => undefined),
    };
    const retryClient: GoogleVisionClient = {
      detectText: vi.fn(async () => {
        throw timeoutError;
      }),
      close: vi.fn(async () => undefined),
    };
    const clientFactory = vi
      .fn<() => GoogleVisionClient>()
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(retryClient);
    const service = new GoogleVisionService({
      clientFactory,
      retryDelayMs: 0,
      retryJitterMs: 0,
      sleep: async () => undefined,
      now: () => 1_000,
      circuitBreakerFailureThreshold: 1,
      circuitBreakerCooldownMs: 30_000,
    });

    await expect(
      service.detectText(Buffer.from("first screenshot"))
    ).rejects.toBe(timeoutError);
    await expect(
      service.detectText(Buffer.from("second screenshot"))
    ).rejects.toBeInstanceOf(GoogleVisionCircuitOpenError);
    expect(clientFactory).toHaveBeenCalledTimes(2);
    expect(retryClient.detectText).toHaveBeenCalledOnce();
  });

  it("uses a fresh client for the single recovery probe after cooldown", async () => {
    const timeoutError = Object.assign(new Error("Vision deadline exceeded"), {
      code: 4,
    });
    const detections: VisionTextDetection[] = [
      {
        description: "Healthy again",
        boundingPoly: { vertices: [] },
      },
    ];
    const failedClient = (): GoogleVisionClient => ({
      detectText: vi.fn(async () => {
        throw timeoutError;
      }),
      close: vi.fn(async () => undefined),
    });
    const firstClient = failedClient();
    const retryClient = failedClient();
    const recoveryClient: GoogleVisionClient = {
      detectText: vi.fn(async () => detections),
      close: vi.fn(async () => undefined),
    };
    const clientFactory = vi
      .fn<() => GoogleVisionClient>()
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(retryClient)
      .mockReturnValueOnce(recoveryClient);
    let now = 1_000;
    const service = new GoogleVisionService({
      clientFactory,
      retryDelayMs: 0,
      retryJitterMs: 0,
      sleep: async () => undefined,
      now: () => now,
      circuitBreakerFailureThreshold: 1,
      circuitBreakerCooldownMs: 30_000,
    });

    await expect(
      service.detectText(Buffer.from("failing screenshot"))
    ).rejects.toBe(timeoutError);
    now += 30_000;

    await expect(
      service.detectText(Buffer.from("recovery screenshot"))
    ).resolves.toEqual(detections);
    expect(clientFactory).toHaveBeenCalledTimes(3);
    expect(retryClient.detectText).toHaveBeenCalledOnce();
    expect(recoveryClient.detectText).toHaveBeenCalledOnce();
  });

  it("logs structured start and success events for each Vision attempt", async () => {
    const detections: VisionTextDetection[] = [
      {
        description: "Observed",
        boundingPoly: { vertices: [] },
      },
    ];
    const client: GoogleVisionClient = {
      detectText: vi.fn(async () => detections),
      close: vi.fn(async () => undefined),
    };
    const logger: GoogleVisionLogger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const times = [1_000, 1_012];
    const service = new GoogleVisionService({
      clientFactory: () => client,
      timeoutMs: 15_000,
      transport: "rest",
      logger,
      requestIdFactory: () => "vision-request-1",
      now: () => times.shift() ?? 1_012,
    });

    await service.detectText(Buffer.from("observed screenshot"));

    expect(logger.info).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        visionRequestId: "vision-request-1",
        attempt: 1,
        maxAttempts: 2,
        clientGeneration: 1,
        transport: "rest",
        timeoutMs: 15_000,
        imageBytes: 19,
      }),
      "Google Vision OCR request started"
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        visionRequestId: "vision-request-1",
        attempt: 1,
        clientGeneration: 1,
        durationMs: 12,
        detectionsCount: 1,
      }),
      "Google Vision OCR request succeeded"
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
