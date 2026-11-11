import { beforeEach, describe, expect, it, vi } from "vitest";
import { switchDiscordAccountAction } from "./auth";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/auth", () => mocks);
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: <T>(_: string, action: T) => action,
}));

beforeEach(() => vi.resetAllMocks());

describe("switch Discord account", () => {
  it("ends the CereBro session before starting Discord authorization", async () => {
    const steps: string[] = [];
    mocks.signOut.mockImplementation(async () => { steps.push("signOut"); });
    mocks.signIn.mockImplementation(async () => { steps.push("signIn"); });

    await switchDiscordAccountAction();

    expect(steps).toEqual(["signOut", "signIn"]);
    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false });
    expect(mocks.signIn).toHaveBeenCalledWith("discord", { redirectTo: "/" }, { prompt: "consent" });
  });

  it("does not start a new sign-in if sign-out fails", async () => {
    mocks.signOut.mockRejectedValue(new Error("Session deletion failed"));
    await expect(switchDiscordAccountAction()).rejects.toThrow("Session deletion failed");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
});
