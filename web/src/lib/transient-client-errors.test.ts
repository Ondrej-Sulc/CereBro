import { describe, expect, it } from "vitest";
import { isTransientPollingError } from "./transient-client-errors";

describe("isTransientPollingError", () => {
  it("matches expected network and stale deployment poll failures", () => {
    expect(isTransientPollingError(new TypeError("Failed to fetch"))).toBe(true);
    expect(
      isTransientPollingError(
        new TypeError("NetworkError when attempting to fetch resource.")
      )
    ).toBe(true);
    expect(
      isTransientPollingError(
        new Error(
          'Server Action "abc123" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action'
        )
      )
    ).toBe(true);
    expect(
      isTransientPollingError(
        new Error("An unexpected response was received from the server.")
      )
    ).toBe(true);
  });

  it("leaves unrelated poll errors reportable", () => {
    expect(isTransientPollingError(new Error("Cannot read properties of null"))).toBe(
      false
    );
  });
});
