import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  logger: { error: vi.fn(), trace: vi.fn() },
}));

vi.mock("@/auth", () => ({ handlers: { GET: mocks.GET, POST: mocks.POST } }));
vi.mock("@/lib/logger", async () => ({
  default: mocks.logger,
  isAbortedResponse: (await import("../../../../lib/expected-framework-errors")).isAbortedResponse,
}));
vi.mock("@/lib/with-request-context", () => ({ withRouteContext: (handler: unknown) => handler }));
vi.mock("@/lib/observability/auth-errors", () => import("../../../../lib/observability/auth-errors"));

import { GET } from "./route";

afterEach(() => vi.clearAllMocks());

describe("Auth.js route error boundary", () => {
  it("keeps unexpected failures safe for both auth and outer request-context logging", async () => {
    const error = new Error("private-token private@example.com", { cause: { client_secret: "private-secret" } });
    mocks.GET.mockRejectedValue(error);
    const request = new NextRequest("https://cerebro.example/api/auth/callback/discord?code=private-code&state=private-state");

    const failure: unknown = await GET(request).catch((caught: unknown) => caught);
    expect(failure).toBeInstanceOf(Error);

    // withRouteContext reports rethrown errors to other observability sinks.
    const logs = JSON.stringify([...mocks.logger.error.mock.calls, { outerError: failure }], (_key, value: unknown) =>
      value instanceof Error ? { message: value.message, cause: value.cause } : value);
    for (const secret of ["private-token", "private@example.com", "private-secret", "private-code", "private-state"]) {
      expect(logs).not.toContain(secret);
    }
    expect(mocks.logger.error).toHaveBeenCalledWith(expect.objectContaining({
      errorType: "Error", path: "/api/auth/callback/discord",
    }), "Critical error in Auth handler");
  });

  it("still allows Next.js redirects to propagate without error logging", async () => {
    const redirect = { digest: "NEXT_REDIRECT;replace;/auth/signin;307;" };
    mocks.GET.mockRejectedValue(redirect);
    await expect(GET(new NextRequest("https://cerebro.example/api/auth/signin"))).rejects.toBe(redirect);
    expect(mocks.logger.error).not.toHaveBeenCalled();
  });

  it("keeps expected response aborts quiet without logging query secrets", async () => {
    mocks.GET.mockRejectedValue(new Error("ResponseAborted"));
    const response = await GET(new NextRequest("https://cerebro.example/api/auth/callback/discord?code=private-code"));
    expect(response.status).toBe(204);
    expect(mocks.logger.error).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.logger.trace.mock.calls)).not.toContain("private-code");
  });
});
