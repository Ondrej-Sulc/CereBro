import { v1 } from "@google-cloud/vision";
import { randomUUID } from "crypto";
import logger from "./loggerService.js";

export interface VisionTextDetection {
  description?: string;
  boundingPoly: {
    vertices: Array<{ x?: number; y?: number }>;
  };
}

export interface GoogleVisionClient {
  detectText(
    imageBuffer: Buffer,
    timeoutMs: number
  ): Promise<VisionTextDetection[]>;
  close(): Promise<void>;
}

export interface GoogleVisionLogger {
  info(context: Record<string, unknown>, message: string): void;
  warn(context: Record<string, unknown>, message: string): void;
}

interface GoogleVisionServiceOptions {
  clientFactory: () => GoogleVisionClient;
  timeoutMs?: number;
  retryDelayMs?: number;
  retryJitterMs?: number;
  sleep?: (durationMs: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  circuitBreakerFailureThreshold?: number;
  circuitBreakerCooldownMs?: number;
  transport?: GoogleVisionTransport;
  logger?: GoogleVisionLogger;
  requestIdFactory?: () => string;
}

interface GoogleCredentials {
  client_email: string;
  private_key: string;
  project_id: string;
}

export type GoogleVisionTransport = "grpc" | "rest";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_DELAY_MS = 100;
const DEFAULT_RETRY_JITTER_MS = 150;
const DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 1;
const DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS = 30_000;

export class GoogleVisionCircuitOpenError extends Error {
  readonly code = "VISION_CIRCUIT_OPEN";
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("Google Vision is temporarily unavailable. Please try again shortly.");
    this.name = "GoogleVisionCircuitOpenError";
    this.retryAfterMs = retryAfterMs;
  }
}

type CircuitState = "closed" | "open" | "half-open";

function getErrorCode(error: unknown): string | number | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }

  const code = error.code;
  return typeof code === "string" || typeof code === "number"
    ? code
    : undefined;
}

function isRetryableVisionError(error: unknown): boolean {
  const code = getErrorCode(error);
  return (
    code === 4 ||
    code === 14 ||
    code === "4" ||
    code === "14" ||
    code === "DEADLINE_EXCEEDED" ||
    code === "UNAVAILABLE" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "EAI_AGAIN"
  );
}

export class GoogleVisionService {
  private client: GoogleVisionClient;
  private readonly clientFactory: () => GoogleVisionClient;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly retryJitterMs: number;
  private readonly sleep: (durationMs: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly circuitBreakerFailureThreshold: number;
  private readonly circuitBreakerCooldownMs: number;
  private readonly transport: GoogleVisionTransport;
  private readonly logger: GoogleVisionLogger;
  private readonly requestIdFactory: () => string;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private circuitState: CircuitState = "closed";
  private clientGeneration = 1;

  constructor(options: GoogleVisionServiceOptions) {
    this.clientFactory = options.clientFactory;
    this.client = this.clientFactory();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.retryJitterMs =
      options.retryJitterMs ?? DEFAULT_RETRY_JITTER_MS;
    this.sleep =
      options.sleep ??
      ((durationMs) =>
        new Promise((resolve) => setTimeout(resolve, durationMs)));
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.circuitBreakerFailureThreshold =
      options.circuitBreakerFailureThreshold ??
      DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD;
    this.circuitBreakerCooldownMs =
      options.circuitBreakerCooldownMs ??
      DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS;
    this.transport = options.transport ?? "rest";
    this.logger = options.logger ?? logger;
    this.requestIdFactory = options.requestIdFactory ?? randomUUID;
  }

  async detectText(imageBuffer: Buffer): Promise<VisionTextDetection[]> {
    const visionRequestId = this.requestIdFactory();
    await this.prepareCircuit(visionRequestId, imageBuffer.length);
    const firstClient = this.client;
    const firstGeneration = this.clientGeneration;

    try {
      const detections = await this.runAttempt(
        firstClient,
        firstGeneration,
        imageBuffer,
        visionRequestId,
        1
      );
      this.recordSuccess(firstGeneration, visionRequestId);
      return detections;
    } catch (error) {
      if (!isRetryableVisionError(error)) {
        this.recordHealthyResponse(firstGeneration, visionRequestId);
        throw error;
      }

      await this.replaceClient(firstClient);

      const jitter = Math.floor(this.random() * this.retryJitterMs);
      await this.sleep(this.retryDelayMs + jitter);
      const retryClient = this.client;
      const retryGeneration = this.clientGeneration;
      try {
        const detections = await this.runAttempt(
          retryClient,
          retryGeneration,
          imageBuffer,
          visionRequestId,
          2
        );
        this.recordSuccess(retryGeneration, visionRequestId);
        return detections;
      } catch (retryError) {
        if (isRetryableVisionError(retryError)) {
          this.recordFailure(
            retryGeneration,
            visionRequestId,
            retryError
          );
        } else {
          this.recordHealthyResponse(retryGeneration, visionRequestId);
        }
        throw retryError;
      }
    }
  }

  private async runAttempt(
    client: GoogleVisionClient,
    clientGeneration: number,
    imageBuffer: Buffer,
    visionRequestId: string,
    attempt: number
  ): Promise<VisionTextDetection[]> {
    const startedAt = this.now();
    const context = {
      visionRequestId,
      attempt,
      maxAttempts: 2,
      clientGeneration,
      transport: this.transport,
      timeoutMs: this.timeoutMs,
      imageBytes: imageBuffer.length,
    };
    this.logger.info(context, "Google Vision OCR request started");

    try {
      const detections = await client.detectText(
        imageBuffer,
        this.timeoutMs
      );
      this.logger.info(
        {
          ...context,
          durationMs: this.now() - startedAt,
          detectionsCount: detections.length,
        },
        "Google Vision OCR request succeeded"
      );
      return detections;
    } catch (error) {
      const retryable = isRetryableVisionError(error);
      this.logger.warn(
        {
          ...context,
          durationMs: this.now() - startedAt,
          errorCode: getErrorCode(error),
          errorMessage:
            error instanceof Error ? error.message : String(error),
          retryable,
          willRetry: retryable && attempt < 2,
        },
        "Google Vision OCR request failed"
      );
      throw error;
    }
  }

  private recordSuccess(
    clientGeneration: number,
    visionRequestId: string
  ): void {
    if (clientGeneration !== this.clientGeneration) {
      return;
    }

    const recoveredCircuit = this.circuitState === "half-open";
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
    this.circuitState = "closed";
    if (recoveredCircuit) {
      this.logger.info(
        { visionRequestId, clientGeneration },
        "Google Vision circuit breaker closed after recovery"
      );
    }
  }

  private recordHealthyResponse(
    clientGeneration: number,
    visionRequestId: string
  ): void {
    this.recordSuccess(clientGeneration, visionRequestId);
  }

  private recordFailure(
    clientGeneration: number,
    visionRequestId: string,
    error: unknown
  ): void {
    if (clientGeneration !== this.clientGeneration) {
      return;
    }

    this.consecutiveFailures++;
    if (
      this.consecutiveFailures >= this.circuitBreakerFailureThreshold
    ) {
      this.circuitOpenUntil = this.now() + this.circuitBreakerCooldownMs;
      this.circuitState = "open";
      this.logger.warn(
        {
          visionRequestId,
          clientGeneration,
          errorCode: getErrorCode(error),
          consecutiveFailures: this.consecutiveFailures,
          cooldownMs: this.circuitBreakerCooldownMs,
        },
        "Google Vision circuit breaker opened"
      );
    }
  }

  private async prepareCircuit(
    visionRequestId: string,
    imageBytes: number
  ): Promise<void> {
    if (this.circuitState === "closed") {
      return;
    }

    const retryAfterMs = this.circuitOpenUntil - this.now();
    if (this.circuitState === "half-open" || retryAfterMs > 0) {
      this.logger.warn(
        {
          visionRequestId,
          transport: this.transport,
          imageBytes,
          retryAfterMs: Math.max(0, retryAfterMs),
          circuitState: this.circuitState,
        },
        "Google Vision circuit breaker rejected OCR request"
      );
      throw new GoogleVisionCircuitOpenError(Math.max(0, retryAfterMs));
    }

    this.circuitState = "half-open";
    await this.replaceClient();
    this.logger.info(
      {
        visionRequestId,
        clientGeneration: this.clientGeneration,
        transport: this.transport,
      },
      "Google Vision circuit breaker started recovery probe"
    );
  }

  private async replaceClient(
    expectedClient?: GoogleVisionClient
  ): Promise<void> {
    if (expectedClient && this.client !== expectedClient) {
      return;
    }

    const failedClient = this.client;
    this.client = this.clientFactory();
    this.clientGeneration++;
    await failedClient.close().catch(() => undefined);
  }
}

export function createGoogleVisionClient(
  credentials: GoogleCredentials,
  transport: GoogleVisionTransport
): GoogleVisionClient {
  const client = new v1.ImageAnnotatorClient({
    credentials,
    fallback: transport === "rest",
  });

  return {
    async detectText(imageBuffer, timeoutMs) {
      const [response] = await client.batchAnnotateImages(
        {
          requests: [
            {
              image: { content: imageBuffer },
              features: [{ type: "TEXT_DETECTION" }],
            },
          ],
        },
        {
          timeout: timeoutMs,
          retry: null,
        }
      );
      const result = response.responses?.[0];

      return (result?.textAnnotations ?? []).map((annotation) => ({
        description: annotation.description ?? undefined,
        boundingPoly: {
          vertices: (annotation.boundingPoly?.vertices ?? []).map((vertex) => ({
            x: vertex.x ?? undefined,
            y: vertex.y ?? undefined,
          })),
        },
      }));
    },
    async close() {
      await client.close();
    },
  };
}

let googleVisionServiceInstance: GoogleVisionService | null = null;

export async function getGoogleVisionService(): Promise<GoogleVisionService> {
  if (!googleVisionServiceInstance) {
    const { config } = await import("../config.js");
    const visionConfig = config.googleVision;
    googleVisionServiceInstance = new GoogleVisionService({
      clientFactory: () =>
        createGoogleVisionClient(
          config.GOOGLE_CREDENTIALS,
          visionConfig.transport
        ),
      timeoutMs: visionConfig.timeoutMs,
      retryDelayMs: visionConfig.retryDelayMs,
      retryJitterMs: visionConfig.retryJitterMs,
      circuitBreakerFailureThreshold:
        visionConfig.circuitBreakerFailureThreshold,
      circuitBreakerCooldownMs: visionConfig.circuitBreakerCooldownMs,
      transport: visionConfig.transport,
    });
  }
  return googleVisionServiceInstance;
}
