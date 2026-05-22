import { describe, expect, it } from "vitest";
import {
  createMissingDiscordChannelMessage,
  findMissingBattlegroupChannels,
  parseMissingDiscordChannelMessage,
} from "./discord-config-validation";

describe("discord config validation", () => {
  it("round-trips missing channel error payloads", () => {
    const message = createMissingDiscordChannelMessage({
      code: "MISSING_DISCORD_CHANNELS",
      missingBattlegroups: [2, 1, 2],
      context: "attack-plan",
    });

    expect(parseMissingDiscordChannelMessage(message)).toEqual({
      code: "MISSING_DISCORD_CHANNELS",
      missingBattlegroups: [1, 2],
      context: "attack-plan",
    });
  });

  it("returns null for non-structured messages", () => {
    expect(parseMissingDiscordChannelMessage("Cannot distribute plan")).toBeNull();
    expect(parseMissingDiscordChannelMessage("DISCORD_CONFIG_ERROR:not-json")).toBeNull();
  });

  it("detects missing attack plan battlegroup channels", () => {
    expect(findMissingBattlegroupChannels({
      battlegroup1ChannelId: "c1",
      battlegroup2ChannelId: null,
      battlegroup3ChannelId: null,
    }, [1, 2, 3])).toEqual([2, 3]);
  });

  it("detects missing defense plan battlegroup channels", () => {
    expect(findMissingBattlegroupChannels({
      battlegroup1ChannelId: null,
      battlegroup2ChannelId: "c2",
      battlegroup3ChannelId: "c3",
    }, [1, 2, 3])).toEqual([1]);
  });
});
