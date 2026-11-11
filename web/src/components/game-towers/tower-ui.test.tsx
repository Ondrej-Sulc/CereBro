// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TowerCatalogEntry, TowerFloorView, TowerBlockView } from "@/lib/game-towers";
import { TowerFloors } from "./tower-floors";
import { TowerBlockControls } from "./tower-block-controls";
import { TowerCatalog, eventEndText } from "./tower-catalog";
import { TowerDetail } from "./tower-detail";
import { TowerRewards } from "./tower-rewards";
import { TowerImage } from "./tower-image";
import { TowerFloorJump } from "./tower-floor-jump";
import raw from "../../../../src/data/game-quests/tower-backend/blocks/class_skill-147.json";
import doom from "../../../../src/data/game-quests/tower-events/blocks/event_castellan_5-001.json";
import goblin from "../../../../src/data/game-quests/tower-events/blocks/event_ggsfa1-001.json";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => { void prefetch; return <a href={href} {...props}>{children}</a>; } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); document.body.innerHTML = ""; push.mockClear(); window.history.replaceState(null, "", "/"); });
async function render(element: React.ReactNode) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(element)); return host;
}
const floor = (): TowerFloorView => ({ ...raw.floors[0], defender: { ...raw.floors[0].defender!, name: "Iron Man", imageUrl: null, href: "/champions/iron-man", className: "Tech", fullHealth: raw.floors[0].defender!.maxHealth }, modifiers: [], topModifiers: [], rewards: [] });

describe("Tower browsing outcomes", () => {
  it("omits a native empty restriction while preserving unresolved nonempty Event restrictions", async () => {
    expect(doom.blockData.heroRestrictions).toBe("");
    expect(goblin.blockData.heroRestrictions).toBe("green_goblin_stellar:t7");
    const tower: TowerCatalogEntry = { id: "event_castellan_5", name: "DOOM TOWER", section: "event", archiveStatus: "unknown", artwork: null, blockNumbers: [1], capturedBlockNumbers: [1], floorCount: 61 };
    const view: TowerBlockView = { tower, block: doom as unknown as TowerBlockView["block"], floors: [], blockRewards: [], ratingRewards: [], entryCost: [], blockModifiers: [], topBlockModifiers: [] };
    const host = await render(<TowerDetail tower={tower} view={view} current={1}/>);
    expect(host.textContent).not.toContain("Attacker restriction");
    expect(host.textContent).not.toContain("Restrictions unresolved");
    await act(async () => root!.render(<TowerDetail tower={tower} view={{ ...view, block: goblin as unknown as TowerBlockView["block"] }} current={1}/>));
    expect(host.textContent).toContain("Attacker restriction");
    expect(host.textContent).toContain("Restriction details unresolved");
  });
  it("separates timed Event Towers and labels missing floor data without implying an account lock", async () => {
    const tower: TowerCatalogEntry = { id: "event_castellan_5", name: "DOOM TOWER", section: "event", archiveStatus: "unknown", artwork: null, blockNumbers: [1, 2], capturedBlockNumbers: [], floorCount: 61, endsAt: "2026-11-18T18:00:00Z" };
    const host = await render(<TowerCatalog towers={[tower]} query="" section="event" status=""/>);
    expect(host.querySelector("#event-heading")?.textContent).toBe("Event Towers");
    expect(host.querySelector("#class-heading")).toBeNull();
    expect(host.querySelector("#challenge-heading")).toBeNull();
    expect(host.textContent).toContain("Defender details unavailable");
    await act(async () => root!.render(<TowerDetail tower={tower} view={null} current={1}/>));
    expect(host.textContent).toContain("Floor details are not available yet");
    expect(host.textContent).not.toContain("Choose one of the recorded blocks");
    expect(host.textContent?.toLowerCase()).not.toContain("locked");
  });
  it("distinguishes past end dates from future schedules without a fabricated countdown", () => {
    const endsAt = "2026-11-18T18:00:00Z";
    expect(eventEndText(endsAt, Date.parse("2026-11-10T00:00:00Z"))).toBe("Ends 18 Nov 2026");
    expect(eventEndText(endsAt, Date.parse("2026-12-10T00:00:00Z"))).toBe("Ended 18 Nov 2026");
    expect(eventEndText(null)).toBeNull();
  });
  it("resets both dirty catalog controls when the URL filters reset", async () => {
    const host = await render(<TowerCatalog towers={[]} query="Saga" section="challenge" status=""/>);
    const input = host.querySelector<HTMLInputElement>('input[name="q"]')!;
    input.value = "Unsubmitted change";
    expect(host.querySelector<HTMLSelectElement>('select[name="section"]')!.value).toBe("challenge");
    await act(async () => root!.render(<TowerCatalog towers={[]} query="" section="" status=""/>));
    expect(host.querySelector<HTMLInputElement>('input[name="q"]')!.value).toBe("");
    expect(host.querySelector<HTMLSelectElement>('select[name="section"]')!.value).toBe("");
    expect(host.querySelector('a[href="/quests/towers"]')?.textContent).not.toBe("Reset");
  });
  it("reflects reloaded floor links and history changes in the floor picker", async () => {
    window.history.replaceState(null, "", "/quests/towers/class_skill?block=147#floor-20");
    const floors = [{ floorNumber: 1, name: "First defender" }, { floorNumber: 20, name: "Last defender" }];
    const host = await render(<TowerFloorJump floors={floors}/>);
    expect(host.querySelector<HTMLSelectElement>("select")!.value).toBe("20");
    await act(async () => {
      window.history.replaceState(null, "", "#floor-1");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(host.querySelector<HTMLSelectElement>("select")!.value).toBe("1");
  });
  it("retains high enemy ascension and uses full native HP instead of current snapshot HP", async () => {
    const f = floor();
    expect(f.defender!.ascensionTier).toBeGreaterThan(2);
    const host = await render(<TowerFloors floors={[f]}/>);
    expect(host.textContent).toContain(`Ascension ${f.defender!.ascensionTier}`);
    const health = [...host.querySelectorAll("dl>div")].find(e => e.querySelector("dt")?.textContent === "Max health");
    expect(health?.querySelector("dd")?.textContent).toBe(f.defender!.maxHealth!.toLocaleString("en"));
    expect(host.textContent).not.toContain("Recorded health");
    expect(host.querySelector("h3 a")?.getAttribute("href")).toBe("/champions/iron-man");
  });
  it("opens every floor node description together and preserves native line breaks", async () => {
    const f = floor(); f.modifiers = [{ id: "source-only-id", name: "Health", description: "First line\\nSecond line", iconKey: null, quantity: 1 }];
    const host = await render(<TowerFloors floors={[f, { ...f, floorNumber: 2 }]}/>);
    const nodes = () => [...host.querySelectorAll("article ul > li > details")];
    expect(nodes().every(e => !e.hasAttribute("open"))).toBe(true);
    await act(async () => host.querySelector<HTMLButtonElement>("button[aria-pressed]")!.click());
    expect(nodes().every(e => e.hasAttribute("open"))).toBe(true);
    expect(host.textContent).toContain("First line\nSecond line");
    expect(host.querySelector("article ul details > summary")?.textContent).not.toContain("source-only-id");
    expect(host.querySelector("article ul details details")?.hasAttribute("open")).toBe(false);
    await act(async () => host.querySelector<HTMLButtonElement>("button[aria-pressed]")!.click());
    expect(nodes().every(e => !e.hasAttribute("open"))).toBe(true);
  });
  it("jumps directly to block147 with filter recovery in the URL and no numeric duplicate control", async () => {
    const host = await render(<TowerBlockControls id="class_skill" current={1} numbers={Array.from({ length: 147 }, (_, i) => i + 1)} from="/quests/towers?q=skill"/>);
    const select = host.querySelector<HTMLSelectElement>("select")!;
    expect(select.options).toHaveLength(147);
    expect(host.querySelector('input[type="number"]')).toBeNull();
    await act(async () => { select.value = "147"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(push).toHaveBeenCalledWith("/quests/towers/class_skill?block=147&from=%2Fquests%2Ftowers%3Fq%3Dskill", { scroll: false });
  });
  it("shows one real Challenge Tower without fabricated archive entries or a speculative status filter", async () => {
    const t: TowerCatalogEntry = { id: "challenge_saga", name: "SAGA SHOWCASE TOWER", section: "challenge", archiveStatus: "unknown", artwork: null, blockNumbers: [1, 2, 3, 4, 5, 6], floorCount: 44 };
    const host = await render(<TowerCatalog towers={[t]} query="" section="challenge" status=""/>);
    expect(host.textContent).toContain("1 Tower"); expect(host.textContent).not.toContain("1 Towers");
    expect(host.querySelector('select[name="status"]')).toBeNull();
    expect(host.querySelectorAll('a[href*="/quests/towers/challenge_saga"]')).toHaveLength(1);
    expect(host.querySelector("h3")?.textContent).toBe("Saga Showcase Tower");
  });
  it("distinguishes unidentified nodes without inventing names and keeps source IDs secondary", async () => {
    const f = floor(); f.modifiers = ["raw-one", "raw-two"].map(id => ({ id, name: "Recorded modifier", description: null, iconKey: null, quantity: 1 }));
    const host = await render(<TowerFloors floors={[f]}/>);
    const summaries = [...host.querySelectorAll("article ul > li > details > summary")].map(e => e.textContent);
    expect(summaries[0]).toContain("Unidentified modifier 1");
    expect(summaries[1]).toContain("Unidentified modifier 2");
    expect(summaries.join(" ")).not.toContain("raw-one");
  });
  it("retains separate unknown rating quantities and labels unresolved identities explicitly", async () => {
    const host = await render(<TowerRewards rewards={["twr", "tmu"].map(token => ({ key: token, scope: "Rating rewards", name: "Rating reward", token, quantity: 1, type: "item", sourceType: "gsi", imageUrl: null, href: null }))}/>);
    expect(host.textContent).toContain("Rating reward details unavailable");
    expect([...host.querySelectorAll("ol > li > strong")].map(e => e.textContent)).toEqual(["\u00d71", "\u00d71"]);
    expect(host.querySelector("details")?.open).toBe(false);
    expect(host.querySelector("summary")?.textContent).toContain("2 records");
  });
  it("replaces failed images with an accessible, stable fallback", async () => {
    const host = await render(<TowerImage src="/missing-art.jpg" alt="Native Tower artwork" className="art"/>);
    await act(async () => host.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(host.querySelector("img")).toBeNull();
    expect(host.querySelector('[data-image-fallback]')?.getAttribute("aria-label")).toBe("Native Tower artwork");
    await act(async () => root!.render(<TowerImage src="/new-art.jpg"/>));
    expect(host.querySelector("img")?.getAttribute("src")).toBe("/new-art.jpg");
  });
});
