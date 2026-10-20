import type { ObservabilityProperties } from "./sanitize";

// Auth errors can contain OAuth responses, adapter arguments, and credentials in
// message/stack/cause. Emit only known types and constant summaries, never those
// raw objects. Do not use the general-purpose sanitizeError for this boundary.
const SAFE_ERROR_TYPES = new Set([
  "AuthError", "AccessDenied", "AdapterError", "CallbackRouteError",
  "ErrorPageLoop", "InvalidCallbackUrl", "InvalidCheck", "JWTSessionError",
  "MissingAdapter", "MissingAdapterMethods", "MissingCSRF", "MissingSecret", "OAuthAccountNotLinked",
  "OAuthCallbackError", "OAuthProfileParseError", "OAuthSignInError",
  "SessionTokenError", "SignOutError", "UnknownAction", "UntrustedHost", "Error", "TypeError",
  "OperationProcessingError", "ResponseBodyError",
]);

const KNOWN_REASONS = new Map<string, { reason: string; message: string }>([
  ["Another account already exists with the same e-mail address", {
    reason: "email_collision", message: "An existing user has the email of an unlinked OAuth account.",
  }],
  ["The account is already associated with another user", {
    reason: "session_user_conflict", message: "The OAuth account belongs to a different user than the active session.",
  }],
  ["pkceCodeVerifier value could not be parsed", {
    reason: "pkce_cookie_invalid", message: "The PKCE cookie could not be verified.",
  }],
  ["pkceCodeVerifier cookie was missing", {
    reason: "pkce_cookie_missing", message: "The PKCE cookie was missing.",
  }],
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

function describeError(error: unknown) {
  const record = asRecord(error);
  const type = record?.type ?? record?.name;
  const safeType = typeof type === "string" && SAFE_ERROR_TYPES.has(type) ? type : "UnknownAuthError";
  const message = typeof record?.message === "string"
    ? record.message.split(". Read more at https://errors.authjs.dev#")[0]
    : "";
  // These messages identify branches in the installed Auth.js version. A changed
  // library message falls back to the type instead of risking sensitive text.
  const known = (safeType === "OAuthAccountNotLinked" || safeType === "InvalidCheck")
    ? KNOWN_REASONS.get(message)
    : undefined;
  return {
    type: safeType,
    reason: known?.reason ?? "unclassified",
    message: known?.message ?? `Authentication failed (${safeType}); raw details omitted.`,
  };
}

export function getSafeAuthErrorDetails(error: unknown): ObservabilityProperties {
  const detail = describeError(error);
  const cause = asRecord(error)?.cause;
  // Auth.js wraps adapter/OAuth failures in { err, ...metadata }; check failures
  // can also carry an Error directly. Never copy the remaining metadata.
  const causeError = asRecord(cause)?.err ?? cause;
  const causeDetail = causeError ? describeError(causeError) : undefined;
  return {
    errorType: detail.type,
    errorReason: detail.reason,
    errorMessage: detail.message,
    ...(causeDetail && {
      causeType: causeDetail.type,
      causeReason: causeDetail.reason,
      causeMessage: causeDetail.message,
    }),
  };
}
