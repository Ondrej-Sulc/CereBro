import { describe, expect, it } from "vitest";
import { isReportableClientException } from "./reportable-client-exceptions";

class TestProgressEvent {
  isTrusted = true;
}
Object.defineProperty(TestProgressEvent, "name", { value: "ProgressEvent" });

class TestCustomEvent {
  isTrusted = true;
}
Object.defineProperty(TestCustomEvent, "name", { value: "CustomEvent" });

describe("isReportableClientException", () => {
  it("ignores raw DOM event objects captured from rejected browser callbacks", () => {
    expect(isReportableClientException(new TestProgressEvent())).toBe(false);
    expect(isReportableClientException(new TestCustomEvent())).toBe(false);
  });

  it("keeps normal errors and primitive throws reportable", () => {
    expect(isReportableClientException(new Error("Failed to parse roster"))).toBe(
      true
    );
    expect(isReportableClientException("plain string throw")).toBe(true);
  });
});
