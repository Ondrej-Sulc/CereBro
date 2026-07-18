import { describe, expect, it } from "vitest";
import {
  getActionErrorMessage,
  isSanitizedServerActionErrorMessage,
} from "./action-errors";

describe("action error messages", () => {
  it("replaces production-sanitized Server Action details with a useful fallback", () => {
    const productionError = new Error(
      "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details."
    );

    expect(getActionErrorMessage(productionError, "Could not save Discord channels. Please try again."))
      .toBe("Could not save Discord channels. Please try again.");
  });

  it("preserves an ordinary actionable error message", () => {
    expect(getActionErrorMessage(
      new Error("The selected BG3 channel is no longer available."),
      "Could not save Discord channels."
    )).toBe("The selected BG3 channel is no longer available.");
  });

  it("recognizes either production sanitization fragment", () => {
    expect(isSanitizedServerActionErrorMessage(
      "The specific message is omitted in production builds."
    )).toBe(true);
  });
});
