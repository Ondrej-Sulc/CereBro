import { describe, expect, it } from "vitest";
import { isIgnoredBrowserErrorMessage } from "./ignored-browser-errors";

describe("isIgnoredBrowserErrorMessage", () => {
  it("matches known ResizeObserver loop browser noise", () => {
    expect(
      isIgnoredBrowserErrorMessage(
        "ResizeObserver loop completed with undelivered notifications."
      )
    ).toBe(true);
    expect(isIgnoredBrowserErrorMessage("ResizeObserver loop limit exceeded")).toBe(
      true
    );
  });

  it("does not match unrelated errors", () => {
    expect(isIgnoredBrowserErrorMessage("Failed to fetch")).toBe(false);
    expect(isIgnoredBrowserErrorMessage(new Error("ResizeObserver loop limit exceeded"))).toBe(
      false
    );
  });
});
