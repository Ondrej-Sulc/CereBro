import { describe, expect, it } from "vitest";
import { isIgnorableInteractionLifecycleError } from "./errorHandler";

describe("isIgnorableInteractionLifecycleError", () => {
  it("matches expired Discord interactions by numeric or string code", () => {
    expect(isIgnorableInteractionLifecycleError({ code: 10062 })).toBe(true);
    expect(isIgnorableInteractionLifecycleError({ code: "10062" })).toBe(true);
  });

  it("matches already-acknowledged Discord interactions by numeric or string code", () => {
    expect(isIgnorableInteractionLifecycleError({ code: 40060 })).toBe(true);
    expect(isIgnorableInteractionLifecycleError({ code: "40060" })).toBe(true);
  });

  it("matches discord.js REST error messages when code is not enumerable", () => {
    expect(
      isIgnorableInteractionLifecycleError(
        new Error("DiscordAPIError[10062]: Unknown interaction")
      )
    ).toBe(true);
    expect(
      isIgnorableInteractionLifecycleError(
        new Error(
          "DiscordAPIError[40060]: Interaction has already been acknowledged."
        )
      )
    ).toBe(true);
  });

  it("does not match unrelated Discord or application errors", () => {
    expect(isIgnorableInteractionLifecycleError({ code: 50001 })).toBe(false);
    expect(isIgnorableInteractionLifecycleError(new Error("Missing Access"))).toBe(
      false
    );
  });
});
