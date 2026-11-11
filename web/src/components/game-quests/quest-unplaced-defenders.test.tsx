// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestUnplacedDefenders } from "./quest-unplaced-defenders";
import { projectUnplacedDefenders, type UnplacedQuestRecord } from "@cerebro/core/domain/game-quests/unplaced-defenders";
import realm3 from "@cerebro/core/data/game-quests/unplaced-defenders/quests/realm3.json";
import labyrinth from "@cerebro/core/data/game-quests/unplaced-defenders/quests/eq_labyrinth.json";
import identities from "@cerebro/core/data/game-quests/unplaced-defenders/identities.json";

vi.mock("next/image", () => ({ default: ({ src, alt, ...props }: { src: string; alt: string; width: number; height: number; sizes: string }) => {
  // eslint-disable-next-line @next/next/no-img-element -- Test-only stand-in for Next Image.
  return <img src={src} alt={alt} {...props} />;
} }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren(); });
async function render(element: ReactNode) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(element)); return host;
}
const abyss = () => projectUnplacedDefenders(realm3 as UnplacedQuestRecord, identities);
const lab = () => projectUnplacedDefenders(labyrinth as UnplacedQuestRecord, identities);
const cards = (host: HTMLElement) => host.querySelectorAll("[data-unplaced-preview]");

describe("optional unplaced preview section", () => {
  it("renders the checked source limit without replacing preview cards or inventing nodes", async () => {
    const notice = "The checked preview lists 63 potential defenders without map locations or personal node modifiers. These entries do not guarantee fights.";
    const host = await render(<QuestUnplacedDefenders data={{ ...abyss(), checkedPreview: { observedAt: "2026-11-10T20:26:28.343411+00:00", notice } }} />);
    expect(host.textContent).toContain(notice);
    expect(cards(host)).toHaveLength(6);
    expect(host.querySelectorAll("[data-map-encounter]")).toHaveLength(0);
  });
  it("shows native names/portraits with explicit uncertainty and six initial cards", async () => {
    const host = await render(<QuestUnplacedDefenders data={abyss()} />);
    expect(cards(host)).toHaveLength(6);
    expect(host.textContent).toContain("Placement unknown");
    expect(host.textContent).toContain("do not guarantee fights");
    expect(host.textContent).toContain("63 saved entries");
    expect(host.textContent).toContain("Repeated entries share a card");
    expect(host.textContent).toContain("EX. THING");
    expect(host.querySelectorAll("[data-quest-portrait=resolved]")).toHaveLength(6);
    expect(host.querySelector("img")?.getAttribute("src")).toBe(identities.npc_abyss_thing_t6.portraitUrl);
    expect(host.querySelectorAll("a,[data-map-encounter]")).toHaveLength(0);
    expect(host.textContent).not.toMatch(/probability|chance|Route \d|\d+ fights on/);
  });

  it("reveals more only on demand, then restores the compact list", async () => {
    const host = await render(<QuestUnplacedDefenders data={abyss()} />);
    const more = () => [...host.querySelectorAll("button")].find(button => button.textContent?.startsWith("Show "))!;
    await act(async () => more().click());
    expect(cards(host)).toHaveLength(18);
    const fewer = [...host.querySelectorAll("button")].find(button => button.textContent === "Show fewer")!;
    await act(async () => fewer.click());
    expect(cards(host)).toHaveLength(6);
  });

  it("searches all source previews, including entries beyond the first six", async () => {
    const data = abyss();
    const host = await render(<QuestUnplacedDefenders data={data} />);
    const input = host.querySelector<HTMLInputElement>("input[type=search]")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setter.call(input, "DARKHAWK"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(cards(host)).toHaveLength(data.previews.filter(preview => preview.identity.name.includes("DARKHAWK")).length);
    expect(host.textContent).toContain("EX. DARKHAWK");
    await act(async () => { setter.call(input, "not a native name"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(cards(host)).toHaveLength(0);
    expect(host.querySelector("[role=status]")?.textContent).toContain("No defender previews match");
  });

  it("shows duplicate entry counts without multiplying the displayed card", async () => {
    const data = lab();
    const host = await render(<QuestUnplacedDefenders data={data} />);
    while (cards(host).length < data.previews.length) {
      const more = [...host.querySelectorAll("button")].find(button => /^Show \d+ more/.test(button.textContent ?? ""))!;
      await act(async () => more.click());
    }
    const repeated = [...cards(host)].filter(card => card.textContent?.includes("GOLDEN ADAPTOID"));
    expect(repeated).toHaveLength(1);
    expect(repeated[0].textContent).toContain("2 saved entries");
    expect(data.rowCount).toBe(31);
  });

  it("resets disclosure/search state when the selected quest changes", async () => {
    const host = await render(<QuestUnplacedDefenders data={abyss()} />);
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(cards(host).length).toBeGreaterThan(6);
    await act(async () => root!.render(<QuestUnplacedDefenders data={lab()} />));
    expect(cards(host)).toHaveLength(6);
    expect(host.querySelector<HTMLInputElement>("input")?.value).toBe("");
    expect(host.textContent).toContain("EX. AGENT VENOM");
  });

  it("labels alternate candidates as potential identities and keeps their portraits", async () => {
    const row = { ...realm3.rows[0], candidateTierIds: [realm3.rows[0].tierId, realm3.rows[1].tierId] };
    const data = projectUnplacedDefenders({ ...realm3, rows: [row] } as UnplacedQuestRecord, identities);
    const host = await render(<QuestUnplacedDefenders data={data} />);
    expect(host.textContent).toContain("Other potential identities (1)");
    expect(host.querySelectorAll("img")).toHaveLength(2);
    expect(host.textContent).toContain("EX. OMEGA RED");
    expect(host.querySelector("input")).toBeNull();
  });
});
