import { describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";

const state = {
  channelId: "channel-1",
  messageId: "message-1",
  roleId: null,
  day: 1,
  status: "active" as const,
  mapStatus: "Section 1 in Progress",
  players: { s1: {}, s2: {}, s3: {} },
  endTimeIso: new Date("2026-05-30T12:00:00Z").toISOString(),
  allianceId: "alliance-1",
};

const getState = vi.fn();
const setState = vi.fn();

vi.mock("./state", () => ({
  getState,
  setState,
}));

describe("handleEnd", () => {
  it("edits existing Components V2 AQ messages without legacy content", async () => {
    getState.mockResolvedValue({ ...state });
    setState.mockResolvedValue(undefined);
    const edit = vi.fn().mockResolvedValue(undefined);
    const channel = {
      id: "channel-1",
      messages: {
        fetch: vi.fn().mockResolvedValue({ edit }),
      },
    };
    const user = { toString: () => "<@user-1>" };
    const { handleEnd } = await import("./end.js");

    await handleEnd({ channel: channel as any, user: user as any });

    expect(edit).toHaveBeenCalledTimes(1);
    const payload = edit.mock.calls[0][0];
    expect(payload.content).toBeUndefined();
    expect(payload.components).toHaveLength(1);
    expect(payload.flags).toEqual([MessageFlags.IsComponentsV2]);
  });
});
