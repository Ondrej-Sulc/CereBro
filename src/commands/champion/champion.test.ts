import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ButtonInteraction, ChatInputCommandInteraction, Client, ComponentType,
  ContainerBuilder, InteractionEditReplyOptions, MessageFlags,
} from "discord.js";
import type { ChampionWithAllRelations } from "../../services/championService";
import { getChampionData, getChampionDataById } from "../../services/championService";
import { command } from "./index";
import { handleChampionViewSwitch } from "./buttonHandler";
import { handleChampionPageSwitch } from "./pageHandler";
import { getAbilitiesContent } from "./abilities";
import { createEmojiResolver } from "../../utils/emojiResolver";

vi.mock("../../services/championService", () => ({
  getChampionData: vi.fn(), getChampionDataById: vi.fn(), championList: [],
}));
// Keep image downloads and application-wide route registration outside this command test.
vi.mock("./thumbnail", () => ({ generateChampionThumbnail: vi.fn(async () => Buffer.from("thumbnail")) }));
vi.mock("../../utils/buttonHandlerRegistry", () => ({ registerButtonHandler: vi.fn() }));
vi.mock("../../services/notificationService", () => ({ sendDuelNotification: vi.fn() }));

function enrichedChampion(): ChampionWithAllRelations {
  const date = new Date("2026-10-20T00:00:00Z");
  const champion: ChampionWithAllRelations = {
    id: 662, name: "Omega Red", slug: "omega-red", shortName: "OR", gameId: "OMEGARED",
    class: "MUTANT", releaseDate: date, obtainable: ["6", "7"], images: {}, discordEmoji: null,
    fullAbilities: { abilities_breakdown: [{ title: "Long ability", description: "Continuous text. ".repeat(700) }] },
    isPlayable: true, createdAt: date, updatedAt: date,
    attacks: [], abilities: [], tags: [], duels: [],
  };
  champion.abilities = Array.from({ length: 40 }, (_, index) => ({
    id: index + 1, championId: champion.id, abilityId: index + 1,
    type: index % 2 === 0 ? "ABILITY" : "IMMUNITY",
    source: `Source ${index}: ${"While the opponent is nearby, preserve this activation condition. ".repeat(8)}`,
    effectForm: "PASSIVE", effectDirection: index % 2 === 0 ? "INFLICT" : "UNKNOWN",
    ability: { id: index + 1, name: `Effect ${String(index).padStart(2, "0")}`, description: null,
      emoji: "<:effect:123456789012345678>", iconUrl: null, gameGlossaryTermId: null },
    synergyChampions: index % 4 === 0 ? [{
      id: index + 1, championId: 663, championAbilityLinkId: index + 1,
      champion: { ...champion, id: 663, name: "Partner", discordEmoji: "<:partner:123456789012345679>" },
    }] : [],
  }));
  champion.tags = Array.from({ length: 400 }, (_, id) => ({ id, name: `Tag ${id}`, category: "Game" }));
  champion.duels = Array.from({ length: 100 }, (_, id) => ({
    id, championId: champion.id, playerName: `Long duel target name ${id}`, rank: "7-star Rank 5", status: "ACTIVE",
    source: "MCOCHUB", submittedByDiscordId: null, createdAt: date, updatedAt: date,
  }));
  return champion;
}

function interaction(view: string, customId = `champion:662:${view}`) {
  const editReply = vi.fn(async (_options: InteractionEditReplyOptions) => undefined);
  return {
    client: new Client({ intents: [] }), customId,
    options: { getSubcommand: () => view, getString: () => "Omega Red" },
    deferReply: vi.fn(), deferUpdate: vi.fn(), editReply,
  };
}

function readReply(options: InteractionEditReplyOptions) {
  expect(options.flags).toEqual([MessageFlags.IsComponentsV2]);
  const container = (options.components as ContainerBuilder[])[0].toJSON();
  const text = container.components.flatMap(component => component.type === ComponentType.TextDisplay ? [component.content] : []).join("");
  expect(text.length).toBeGreaterThan(0);
  // Discord applies this across the message, including duel credits and help text.
  expect(text.length).toBeLessThanOrEqual(4000);
  const buttons = container.components.flatMap(component => component.type === ComponentType.ActionRow ? component.components : []);
  return { text, buttons };
}

beforeEach(() => {
  vi.clearAllMocks();
  const champion = enrichedChampion();
  vi.mocked(getChampionData).mockResolvedValue(champion);
  vi.mocked(getChampionDataById).mockResolvedValue(champion);
});

describe("champion command responses with enriched data", () => {
  it.each(["abilities", "immunities", "overview", "info", "attacks", "tags", "duel"])("serializes /champion %s within Discord's limits", async view => {
    const initial = interaction(view);
    await command.execute(initial as unknown as ChatInputCommandInteraction);
    let reply = readReply(initial.editReply.mock.calls[0][0]);
    let pageCount = 1;
    while (true) {
      const next = reply.buttons.find(button => "label" in button && button.label === "Next");
      if (!next || next.disabled || !("custom_id" in next)) break;
      expect(pageCount++).toBeLessThan(30);
      const page = interaction(view, next.custom_id);
      await handleChampionPageSwitch(page as unknown as ButtonInteraction);
      expect(page.editReply).toHaveBeenCalledOnce();
      reply = readReply(page.editReply.mock.calls[0][0]);
    }
  });

  it.each(["abilities", "immunities", "overview", "info", "tags", "duel"])("paginates the %s view when selected by a button", async view => {
    const button = interaction(view);
    await handleChampionViewSwitch(button as unknown as ButtonInteraction);
    const { buttons } = readReply(button.editReply.mock.calls[0][0]);
    expect(buttons).toContainEqual(expect.objectContaining({ label: "Next", disabled: false }));
  });

  it("reaches every ability source through the Next buttons without dropping text", async () => {
    const initial = interaction("abilities");
    await command.execute(initial as unknown as ChatInputCommandInteraction);
    let reply = readReply(initial.editReply.mock.calls[0][0]);
    let combined = reply.text;
    let pages = 1;
    while (true) {
      const next = reply.buttons.find(button => "label" in button && button.label === "Next");
      if (!next || next.disabled || !("custom_id" in next)) break;
      expect(pages++).toBeLessThan(30);
      const page = interaction("abilities", next.custom_id);
      await handleChampionPageSwitch(page as unknown as ButtonInteraction);
      expect(page.editReply).toHaveBeenCalledOnce();
      reply = readReply(page.editReply.mock.calls[0][0]);
      combined += reply.text;
    }
    expect(pages).toBeGreaterThan(1);
    expect(combined).toBe(getAbilitiesContent(enrichedChampion(), createEmojiResolver(initial.client)));
    const previous = reply.buttons.find(button => "label" in button && button.label === "Previous");
    expect(previous).toMatchObject({ disabled: false });
  });

  it("does not produce an empty first page for a single oversized info paragraph", async () => {
    const first = interaction("info");
    await command.execute(first as unknown as ChatInputCommandInteraction);
    const { text } = readReply(first.editReply.mock.calls[0][0]);
    expect(text).toContain("Continuous text.");
  });

  it("budgets the overview's combined sections even when each section fits individually", async () => {
    const champion = enrichedChampion();
    champion.abilities = champion.abilities.slice(0, 12);
    champion.tags = [];
    vi.mocked(getChampionData).mockResolvedValue(champion);
    const initial = interaction("overview");
    await command.execute(initial as unknown as ChatInputCommandInteraction);
    const { buttons } = readReply(initial.editReply.mock.calls[0][0]);
    expect(buttons).toContainEqual(expect.objectContaining({ label: "Next", disabled: false }));
  });
});
