// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChampionCard } from "./champion-card";
import type { ProfileRosterEntry } from "../types";

vi.mock("next/image", () => ({ default: () => null }));
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
const item = (isPlayable: boolean, isUnowned = false) => ({ id: "entry", championId: 1, stars: 7, rank: 3, sigLevel: 0, ascensionLevel: 0, isUnowned, champion: { id: 1, name: "Ares", class: "SKILL", isPlayable, images: {} } }) as unknown as ProfileRosterEntry;

it("keeps NPC cards viewable without offering editing, reservation or owned prestige", async () => {
  const onClick = vi.fn(), onQuickView = vi.fn(), onToggleAttackReservation = vi.fn();
  const npc = item(false);
  await act(async () => root.render(<ChampionCard item={npc} prestige={12345} onClick={onClick} onQuickView={onQuickView} mode="edit" canManageAttackReservations onToggleAttackReservation={onToggleAttackReservation} />));
  const card = document.querySelector<HTMLElement>('[data-roster-entry-id]')!;
  expect(card.getAttribute("aria-label")).toBe("View Ares");
  expect(document.querySelector("button")).toBeNull();
  expect(card.textContent).toContain("NPC & legacy");
  expect(card.textContent).not.toContain("12,345");
  await act(async () => card.click());
  expect(onClick).not.toHaveBeenCalled(); expect(onQuickView).toHaveBeenCalledWith(npc);
});

it("preserves playable editing and does not give catalog NPCs an unowned visual state", async () => {
  const onClick = vi.fn();
  const entry = item(true);
  entry.champion.slug = "ares";
  await act(async () => root.render(<ChampionCard item={entry} onClick={onClick} onQuickView={vi.fn()} mode="edit" />));
  const card = document.querySelector<HTMLElement>('[data-roster-entry-id]')!;
  expect(card.getAttribute("aria-label")).toBe("Edit Ares"); await act(async () => card.click()); expect(onClick).toHaveBeenCalled();
  await act(async () => root.render(<ChampionCard item={item(false, true)} onClick={onClick} onQuickView={vi.fn()} mode="view" />));
  expect(document.querySelector('[data-roster-entry-id]')?.className).not.toContain("grayscale");
});

it.each([true, false])("links directly to the champion page when the overview is empty (catalog: %s)", async catalogMode => {
  const onQuickView = vi.fn();
  const entry = item(true, catalogMode);
  entry.champion.slug = "ares";
  entry.champion.abilities = [];
  await act(async () => root.render(<ChampionCard item={entry} onClick={vi.fn()} onQuickView={onQuickView} mode="view" catalogMode={catalogMode} />));
  const card = document.querySelector('[data-roster-entry-id]')!;
  const link = card.querySelector<HTMLAnchorElement>('a[aria-label="View Ares"]');
  expect(link?.getAttribute("href")).toBe(catalogMode ? "/champions/ares" : "/champions/ares?rarity=7&rank=3&sig=0&ascension=0");
  expect(card.hasAttribute("aria-haspopup")).toBe(false);
  link!.addEventListener("click", event => event.preventDefault());
  await act(async () => link!.click());
  expect(onQuickView).not.toHaveBeenCalled();
});

it("keeps the kit popup for a linked champion with overview effects", async () => {
  const onQuickView = vi.fn();
  const entry = item(false, true);
  entry.champion.slug = "ares";
  entry.champion.abilities = [{ id: 1, type: "IMMUNITY", source: null, ability: { name: "Bleed", iconUrl: null, gameGlossaryTermId: null, description: null, gameGlossaryTerm: null, categories: [] }, synergyChampions: [] }];
  await act(async () => root.render(<ChampionCard item={entry} onClick={vi.fn()} onQuickView={onQuickView} mode="view" catalogMode />));
  const card = document.querySelector<HTMLElement>('[data-roster-entry-id][aria-haspopup="dialog"]')!;
  await act(async () => card.click());
  expect(onQuickView).toHaveBeenCalledWith(entry);
});

it("skips the popup when every overview effect requires a different rarity", async () => {
  const entry = item(true);
  entry.champion.slug = "ares";
  entry.champion.abilities = [{ id: 1, type: "ABILITY", source: "Synergy: Team Up (6★) with Partner (6★). Gains Fury.", ability: { name: "Fury", iconUrl: null, gameGlossaryTermId: null, description: null, gameGlossaryTerm: null, categories: [] }, synergyChampions: [] }];
  await act(async () => root.render(<ChampionCard item={entry} onClick={vi.fn()} onQuickView={vi.fn()} mode="view" />));
  expect(document.querySelector('a[aria-label="View Ares"]')?.getAttribute("href")).toContain("/champions/ares?rarity=7");
});
