const SANITIZED_SERVER_ACTION_ERROR_FRAGMENTS = [
  "An error occurred in the Server Components render",
  "The specific message is omitted in production builds",
] as const;

export function isSanitizedServerActionErrorMessage(message: string): boolean {
  return SANITIZED_SERVER_ACTION_ERROR_FRAGMENTS.some((fragment) =>
    message.includes(fragment)
  );
}

export function getActionErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";

  if (!message || isSanitizedServerActionErrorMessage(message)) {
    return fallback;
  }

  return message;
}
