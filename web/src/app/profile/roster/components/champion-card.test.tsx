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
  await act(async () => root.render(<ChampionCard item={item(true)} onClick={onClick} onQuickView={vi.fn()} mode="edit" />));
  const card = document.querySelector<HTMLElement>('[data-roster-entry-id]')!;
  expect(card.getAttribute("aria-label")).toBe("Edit Ares"); await act(async () => card.click()); expect(onClick).toHaveBeenCalled();
  await act(async () => root.render(<ChampionCard item={item(false, true)} onClick={onClick} onQuickView={vi.fn()} mode="view" />));
  expect(document.querySelector('[data-roster-entry-id]')?.className).not.toContain("grayscale");
});
