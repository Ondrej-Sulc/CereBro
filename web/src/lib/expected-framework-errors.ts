type FrameworkErrorLike = {
  name?: unknown;
  message?: unknown;
  digest?: unknown;
};

export function isAbortedResponse(error: unknown): boolean {
  if (!error) return false;
  const candidate = error as FrameworkErrorLike;
  return (
    candidate.name === "ResponseAborted" ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("ResponseAborted"))
  );
}

export function isExpectedFrameworkInterruption(error: unknown): boolean {
  if (!error) return false;
  if (isAbortedResponse(error)) return true;

  const candidate = error as FrameworkErrorLike;
  return (
    candidate.name === "DynamicServerError" ||
    candidate.digest === "DYNAMIC_SERVER_USAGE"
  );
}
