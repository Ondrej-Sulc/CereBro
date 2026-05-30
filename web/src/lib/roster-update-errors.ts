import axios from "axios";

export interface QuotaLimitError {
  limit: number;
  used: number;
  remaining: number;
  requested: number;
  resetAt: string;
  supportUrl: string;
}

export interface RosterUpdateErrorState {
  errorMessage: string;
  quotaLimitError: QuotaLimitError | null;
  shouldReportException: boolean;
}

export function getRosterUpdateErrorState(
  err: unknown,
  requestedFiles: number
): RosterUpdateErrorState {
  let errorMessage = "Failed to update roster";
  let quotaLimitError: QuotaLimitError | null = null;
  let shouldReportException = true;

  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | (Partial<QuotaLimitError> & { error?: string; reason?: string })
      | undefined;
    errorMessage = data?.error || err.message;

    if (err.response?.status === 403 && data?.reason === "free_limit_exceeded") {
      quotaLimitError = {
        limit: typeof data.limit === "number" ? data.limit : 5,
        used: typeof data.used === "number" ? data.used : 0,
        remaining: typeof data.remaining === "number" ? data.remaining : 0,
        requested:
          typeof data.requested === "number" ? data.requested : requestedFiles,
        resetAt: typeof data.resetAt === "string" ? data.resetAt : "",
        supportUrl: typeof data.supportUrl === "string" ? data.supportUrl : "/support",
      };
      shouldReportException = false;
    }
  } else if (err instanceof Error) {
    errorMessage = err.message;
  }

  return { errorMessage, quotaLimitError, shouldReportException };
}
