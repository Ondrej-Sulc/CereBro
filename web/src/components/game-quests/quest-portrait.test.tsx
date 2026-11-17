import { expect, it } from "vitest";
import type { GameIdentity } from "@cerebro/core/domain/game-quests";
import type { QuestPortrait } from "@/lib/game-quests/presentation";
import { questEncounterPortrait } from "./quest-portrait";

const identity: GameIdentity = { gameId: "ares", tierId: "ares_t7", rarity: 7, name: "ARES", champion: null };
const portrait: QuestPortrait = { name: "Ares", href: "/champions/ares", imageUrl: "/test/ares.png", className: "Skill", color: "red", championBinding: { id: 809, gameId: "ares" } };

it("accepts exact positive DB bindings while rejecting absent, invalid and mismatched NPC bindings", () => {
  expect(questEncounterPortrait(identity, { ares: portrait })).toBe(portrait);
  expect(questEncounterPortrait(identity, { ares: { ...portrait, championBinding: undefined } })).toBeUndefined();
  expect(questEncounterPortrait(identity, { ares: { ...portrait, championBinding: { id: 0, gameId: "ares" } } })).toBeUndefined();
  expect(questEncounterPortrait(identity, { ares: { ...portrait, championBinding: { id: 809, gameId: "grandmaster" } } })).toBeUndefined();
  expect(questEncounterPortrait({ ...identity, champion: { id: 810, name: "Ares", slug: "ares" } }, { ares: portrait })).toBeUndefined();
});

it("keeps unbound source-matched native art unlinked", () => {
  const native = { ...portrait, href: null, championBinding: undefined, nativeGameId: "ares", imageUrl: "/game-quests/progressed-art/ares.webp" };
  expect(questEncounterPortrait(identity, { ares: native })).toBe(native);
  expect(questEncounterPortrait(identity, { ares: { ...native, href: "/champions/ares" } })).toBeUndefined();
});
