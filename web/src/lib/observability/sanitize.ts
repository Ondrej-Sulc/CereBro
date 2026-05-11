export type ObservabilityProperty =
  | string
  | number
  | boolean
  | null
  | undefined;

export type ObservabilityProperties = Record<string, ObservabilityProperty>;

const MAX_STRING_LENGTH = 500;

export function truncate(value: string, max = MAX_STRING_LENGTH): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

export function sanitizeError(error: unknown): ObservabilityProperties {
  if (error instanceof Error) {
    const digest = (error as Error & { digest?: unknown }).digest;
    const code = (error as Error & { code?: unknown }).code;

    return {
      error_name: error.name || "Error",
      error_message: truncate(error.message || "Unknown error"),
      error_digest: typeof digest === "string" ? truncate(digest, 160) : undefined,
      error_code: typeof code === "string" ? truncate(code, 80) : undefined,
    };
  }

  return {
    error_name: "NonError",
    error_message: truncate(String(error ?? "Unknown error")),
  };
}

export function normalizeProperties(
  properties: Record<string, unknown> = {}
): ObservabilityProperties {
  const normalized: ObservabilityProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null) {
      normalized[key] = value;
    } else if (typeof value === "string") {
      normalized[key] = truncate(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      normalized[key] = value;
    } else if (value instanceof Date) {
      normalized[key] = value.toISOString();
    } else {
      normalized[key] = truncate(JSON.stringify(value));
    }
  }

  return normalized;
}
