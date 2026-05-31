import { describe, expect, it, vi } from "vitest";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { handleStart } from "./start";

describe("handleStart", () => {
  it("returns an ephemeral permission message before sending when the bot cannot send in the target channel", async () => {
    const send = vi.fn();
    const result = await handleStart({
      day: 1,
      battlegroup: 1,
      pingRoleId: null,
      channel: {
        id: "channel-1",
        name: "aq-bg1",
        send,
        isThread: () => false,
        permissionsFor: () => ({
          has: (permission: bigint) =>
            permission === PermissionFlagsBits.ViewChannel,
        }),
      } as any,
      guild: {
        id: "guild-1",
        members: { me: { id: "bot-1" } },
      } as any,
      channelName: "aq-bg1",
      battlegroupName: "Battlegroup 1",
      userId: "user-1",
    });

    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({
      content:
        "I don't have permission to send AQ tracker messages in **aq-bg1**. Please grant me permission to view and send messages there, then try again.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("requires attach-files permission before sending the tracker image", async () => {
    const send = vi.fn();
    const result = await handleStart({
      day: 1,
      battlegroup: 1,
      pingRoleId: null,
      channel: {
        id: "channel-1",
        name: "aq-bg1",
        send,
        isThread: () => false,
        permissionsFor: () => ({
          has: (permission: bigint) =>
            permission === PermissionFlagsBits.ViewChannel ||
            permission === PermissionFlagsBits.SendMessages,
        }),
      } as any,
      guild: {
        id: "guild-1",
        members: { me: { id: "bot-1" } },
      } as any,
      channelName: "aq-bg1",
      battlegroupName: "Battlegroup 1",
      userId: "user-1",
    });

    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({
      content:
        "I don't have permission to send AQ tracker messages in **aq-bg1**. Please grant me permission to view and send messages there, then try again.",
      flags: MessageFlags.Ephemeral,
    });
  });
});
