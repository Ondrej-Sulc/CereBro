import { expect, it, vi } from "vitest";
import { ComponentType, ContainerBuilder } from "discord.js";
import { prisma } from "../../services/prismaService";
import { overviewSourceHash } from "../../domain/champion-overview-summary";
import { handleEffect } from "./effect";

vi.mock("../../services/prismaService", () => ({ prisma: {
  ability: { findFirst: vi.fn() }, player: { findFirst: vi.fn() }, champion: { findMany: vi.fn() },
  gameSynergy: { findMany: vi.fn(async () => []) },
} }));
vi.mock("./index", () => ({ glossaryColors: { containers: { effect: 0x323232 }, buttons: { search: 2, category: 1, navigation: 2 } } }));

it("shows resistance-only champions in the glossary without claiming immunity", async () => {
  const date = new Date("2026-10-20T00:00:00Z");
  const effect = { id: 4, name: "Bleed", description: null, emoji: null, iconUrl: null, gameGlossaryTermId: null, categories: [] };
  const source = { id: 1, championId: 2, abilityId: 3, type: "ABILITY" as const,
    source: "Incoming Bleed potency is reduced while charging Heavy.", effectForm: "PASSIVE" as const,
    effectDirection: "GAIN" as const, ability: { ...effect, id: 3, name: "Bleed Resistance", categories: [] }, synergyChampions: [],
  };
  const champion = { id: 2, name: "Example", slug: "example", shortName: "EX", gameId: "example", class: "MUTANT" as const,
    releaseDate: date, createdAt: date, updatedAt: date, obtainable: ["6"], images: {}, discordEmoji: null,
    fullAbilities: {}, isPlayable: true, tags: [], attacks: [], abilities: [{ ...source, resistances: [{
      effectId: 4, effect, mechanism: "POTENCY", percent: null, evidence: { version: 1, records: [] },
      sourceHash: overviewSourceHash({ ...source, name: source.ability.name, synergyChampionIds: [] }),
    }] }],
  };
  vi.mocked(prisma.ability.findFirst).mockResolvedValue(effect);
  vi.mocked(prisma.player.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.champion.findMany).mockResolvedValue([champion]);
  const result = await handleEffect("Bleed", text => text, "user");
  const container = (result.components as ContainerBuilder[])[0].toJSON();
  const text = container.components.flatMap(component => component.type === ComponentType.TextDisplay ? [component.content] : []).join("\n");
  expect(text).toContain("Champions resistant to this effect");
  expect(text).toContain("Example");
  expect(text).not.toContain("Champions immune to this effect");
  expect(text).not.toContain("Champions with this effect");
});
