const TRANSIENT_POLLING_ERROR_FRAGMENTS = [
  "Failed to fetch",
  "NetworkError when attempting to fetch resource",
  "network error",
  "Load failed",
  "An unexpected response was received from the server",
  "was not found on the server",
];

export function getClientErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isTransientPollingError(error: unknown): boolean {
  const message = getClientErrorMessage(error);
  return TRANSIENT_POLLING_ERROR_FRAGMENTS.some((fragment) =>
    message.includes(fragment)
  );
}
