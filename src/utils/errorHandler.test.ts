import { describe, expect, it, vi } from "vitest";
import { MessageFlags, MessageFlagsBitField, RepliableInteraction } from "discord.js";
import { isIgnorableInteractionLifecycleError, safeReply } from "./errorHandler";

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

describe("safeReply", () => {
  function interaction(component: boolean, replied = false) {
    const message = { flags: new MessageFlagsBitField(MessageFlags.IsComponentsV2) };
    return {
      id: "interaction", type: component ? 3 : 2,
      isRepliable: () => true, isMessageComponent: () => component,
      deferred: !replied, replied, message, ephemeral: null as boolean | null,
      fetchReply: vi.fn(async () => message),
      editReply: vi.fn(), followUp: vi.fn(), reply: vi.fn(),
    };
  }

  it("reports a component-button error privately without editing V2 messages with legacy content", async () => {
    const button = interaction(true);
    await safeReply(button as unknown as RepliableInteraction, "Command failed");
    expect(button.editReply).not.toHaveBeenCalled();
    expect(button.followUp).toHaveBeenCalledWith({ content: "Command failed", flags: [MessageFlags.Ephemeral] });
  });

  it("also handles an already-replied slash command whose response uses Components V2", async () => {
    const command = interaction(false, true);
    await safeReply(command as unknown as RepliableInteraction, "Command failed");
    expect(command.editReply).not.toHaveBeenCalled();
    expect(command.followUp).toHaveBeenCalledWith({ content: "Command failed", flags: [MessageFlags.Ephemeral] });
  });

  it("keeps deferred slash-command errors in the original reply", async () => {
    const command = interaction(false);
    await safeReply(command as unknown as RepliableInteraction, "Command failed");
    expect(command.editReply).toHaveBeenCalledWith({ content: "Command failed" });
    expect(command.fetchReply).not.toHaveBeenCalled();
  });

  it("still edits legacy component responses normally", async () => {
    const button = interaction(true);
    button.message.flags = new MessageFlagsBitField();
    await safeReply(button as unknown as RepliableInteraction, "Command failed");
    expect(button.editReply).toHaveBeenCalledWith({ content: "Command failed" });
    expect(button.followUp).not.toHaveBeenCalled();
  });

  it("resolves a button's separate deferred reply even when the source card uses V2", async () => {
    const button = interaction(true);
    button.ephemeral = true;
    await safeReply(button as unknown as RepliableInteraction, "Command failed");
    expect(button.editReply).toHaveBeenCalledWith({ content: "Command failed" });
    expect(button.followUp).not.toHaveBeenCalled();
  });

  it("checks a button's separate response rather than its original V2 card after reply", async () => {
    const button = interaction(true, true);
    button.ephemeral = true;
    button.fetchReply.mockResolvedValue({ flags: new MessageFlagsBitField() });
    await safeReply(button as unknown as RepliableInteraction, "Command failed");
    expect(button.editReply).toHaveBeenCalledWith({ content: "Command failed" });
    expect(button.followUp).not.toHaveBeenCalled();
  });
});
