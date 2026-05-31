import axios from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { getRosterUpdateErrorState } from "./roster-update-errors";

function axiosResponse(status: number, data: unknown): AxiosResponse {
  return {
    status,
    statusText: status === 403 ? "Forbidden" : "",
    headers: {},
    config: {} as InternalAxiosRequestConfig,
    data,
  };
}

describe("getRosterUpdateErrorState", () => {
  it("treats quota-limit 403 responses as handled product state", () => {
    const error = new axios.AxiosError(
      "Request failed",
      undefined,
      undefined,
      undefined,
      axiosResponse(403, {
        error: "You have used 5/5 screenshots this month.",
        reason: "free_limit_exceeded",
        limit: 5,
        used: 5,
        remaining: 0,
        requested: 2,
        resetAt: "2026-06-01T00:00:00.000Z",
        supportUrl: "/support",
      })
    );

    const state = getRosterUpdateErrorState(error, 2);

    expect(state.errorMessage).toBe("You have used 5/5 screenshots this month.");
    expect(state.quotaLimitError).toMatchObject({
      limit: 5,
      used: 5,
      remaining: 0,
      requested: 2,
      supportUrl: "/support",
    });
    expect(state.shouldReportException).toBe(false);
  });

  it("keeps unexpected 403 responses reportable", () => {
    const error = new axios.AxiosError(
      "Request failed",
      undefined,
      undefined,
      undefined,
      axiosResponse(403, { error: "Unauthorized" })
    );

    const state = getRosterUpdateErrorState(error, 1);

    expect(state.errorMessage).toBe("Unauthorized");
    expect(state.quotaLimitError).toBeNull();
    expect(state.shouldReportException).toBe(true);
  });
});
