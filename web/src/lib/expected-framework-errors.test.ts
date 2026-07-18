import { describe, expect, it } from "vitest";
import {
  isAbortedResponse,
  isExpectedFrameworkInterruption,
} from "./expected-framework-errors";

describe("expected framework errors", () => {
  it("recognizes aborted responses", () => {
    expect(isAbortedResponse({ name: "ResponseAborted" })).toBe(true);
    expect(isAbortedResponse(new Error("ResponseAborted while streaming"))).toBe(true);
  });

  it("recognizes Next.js static-render bailouts", () => {
    expect(
      isExpectedFrameworkInterruption({
        name: "DynamicServerError",
        digest: "DYNAMIC_SERVER_USAGE",
        description: "Route used headers",
      })
    ).toBe(true);
  });

  it("leaves real application failures reportable", () => {
    expect(
      isExpectedFrameworkInterruption(new Error("Database connection failed"))
    ).toBe(false);
  });
});
