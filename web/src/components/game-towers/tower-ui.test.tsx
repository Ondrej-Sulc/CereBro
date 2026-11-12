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
import { TowerDiscovery } from "./tower-discovery";
import raw from "../../../../src/data/game-quests/tower-backend/blocks/class_skill-147.json";
import doom from "../../../../src/data/game-quests/tower-events/blocks/event_castellan_5-001.json";
import goblin from "../../../../src/data/game-quests/tower-events/blocks/event_ggsfa1-001.json";

const push = vi.hoisted(() => vi.fn());
const loadTowerCatalog = vi.hoisted(() => vi.fn<() => Promise<TowerCatalogEntry[]>>());
vi.mock("@/lib/game-towers", () => ({ getTowerCatalog: loadTowerCatalog }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, prefetch, scroll, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean; scroll?:boolean }) => { void prefetch; void scroll; return <a href={href} {...props}>{children}</a>; } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); document.body.innerHTML = ""; push.mockClear(); window.history.replaceState(null, "", "/"); });
async function render(element: React.ReactNode) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(element)); return host;
}
const floor = (): TowerFloorView => ({ ...raw.floors[0], defender: { ...raw.floors[0].defender!, name: "Iron Man", imageUrl: null, href: "/champions/iron-man", className: "Tech", fullHealth: raw.floors[0].defender!.maxHealth }, modifiers: [], topModifiers: [], rewards: [] });

describe("Tower browsing outcomes", () => {
  it("shows Challenge and Event artwork cards alongside all six Class Towers on the quest landing page", async () => {
    const classes: TowerCatalogEntry[] = ["skill", "mutant", "tech", "cosmic", "mystic", "science"].map(id => ({
      id: `class_${id}`, name: `${id.toUpperCase()} TOWER`, section: "class", archiveStatus: "unknown", classId: id,
      artwork: { url: `/game-towers/classes/${id}.jpg`, width: 326, height: 659 }, blockNumbers: [1, 2], floorCount: 1606,
    }));
    const towers: TowerCatalogEntry[] = [...classes,
      { id: "challenge_saga", name: "SAGA SHOWCASE TOWER", section: "challenge", archiveStatus: "unknown", artwork: { url: "/game-towers/challenges/challenge_saga.jpg", width: 326, height: 659 }, blockNumbers: [1, 2, 3, 4, 5, 6], floorCount: 44 },
      { id: "event_castellan_5", name: "DOOM TOWER", section: "event", archiveStatus: "unknown", artwork: { url: "/game-towers/events/event_castellan_5.jpg", width: 326, height: 659 }, blockNumbers: [1, 2], floorCount: 61, endsAt: "2026-11-18T18:00:00Z" },
      { id: "event_ggsfa1", name: "GREEN GOBLIN (STELLAR-FORGED) TOWER", section: "event", archiveStatus: "unknown", artwork: { url: "/game-towers/events/event_ggsfa1.jpg", width: 326, height: 659 }, blockNumbers: [1, 2], floorCount: 2 },
    ];
    loadTowerCatalog.mockResolvedValue(towers);
    const host = await render(await TowerDiscovery());
    const cards = [...host.querySelectorAll<HTMLAnchorElement>('a[href^="/quests/towers/"]')];
    expect(cards).toHaveLength(9);
    for (const tower of towers) {
      const card = cards.find(link => link.getAttribute("href") === `/quests/towers/${tower.id}`)!;
      expect(card).toBeDefined();
      expect(card.querySelector("img")?.getAttribute("src")).toBe(tower.artwork?.url);
      expect(card.textContent).toContain("Explore Tower");
    }
    expect(cards[6].textContent).toContain("Challenge Tower");
    expect(cards[6].textContent).toContain("44 floors");
    expect(cards[7].textContent).toContain("Event Tower");
    expect(cards[7].querySelector("time")?.dateTime).toBe("2026-11-18T18:00:00Z");
  });
  it("omits a native empty restriction while preserving unresolved nonempty Event restrictions", async () => {
    expect(doom.blockData.heroRestrictions).toBe("");
    expect(goblin.blockData.heroRestrictions).toBe("green_goblin_stellar:t7");
    const tower: TowerCatalogEntry = { id: "event_castellan_5", name: "DOOM TOWER", section: "event", archiveStatus: "unknown", artwork: null, blockNumbers: [1], capturedBlockNumbers: [1], floorCount: 61 };
    const view: TowerBlockView = { tower, block: doom as unknown as TowerBlockView["block"], floors: [], blockRewards: [], ratingRewards: [], entryCost: [], blockModifiers: [], topBlockModifiers: [] };
    const host = await render(<TowerDetail tower={tower} view={view} current={1}/>);
    expect([...host.querySelectorAll('h2')].filter(h=>h.textContent==='Block 1')).toHaveLength(1);
    expect(host.querySelector('select[aria-label="Jump to block"]')).toBeNull();
    expect(host.querySelector('#block-reader')?.getAttribute('tabindex')).toBe('-1');
    expect(host.textContent).not.toMatch(/Source & definition details|Source receipt|Native block fields|Native floor fields/);
    expect(host.querySelector('pre')).toBeNull();
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
    const build = host.querySelector("h3")!.nextElementSibling!;
    expect(build.textContent).toContain(`Sig ${f.defender!.signature}`);
    expect(build.textContent).toContain(`Ascension ${f.defender!.ascensionTier}`);
    expect([...host.querySelectorAll("summary")].some(e => e.textContent === "Defender stats")).toBe(false);
    const health = [...host.querySelectorAll("dl>div")].find(e => e.querySelector("dt")?.textContent === "Max health");
    expect(health?.querySelector("dd")?.textContent).toBe(f.defender!.maxHealth!.toLocaleString("en"));
    const stats = host.querySelector("article dl")!;
    expect([...stats.querySelectorAll("dt")].map(term => term.textContent)).toEqual(["Challenge rating", "Max health", "Attack"]);
    expect(stats.querySelector("dd")?.textContent).toBe(f.defender!.challengeRating!.toLocaleString("en"));
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
    expect(host.textContent).not.toContain("source-only-id");
    await act(async () => host.querySelector<HTMLButtonElement>("button[aria-pressed]")!.click());
    expect(nodes().every(e => !e.hasAttribute("open"))).toBe(true);
  });
  it("opens a compact block heading and jumps directly to147 while preserving filter context", async () => {
    const host = await render(<TowerBlockControls id="class_skill" current={1} numbers={Array.from({ length: 147 }, (_, i) => i + 1)} from="/quests/towers?q=skill"/>);
    expect(host.querySelector('select')).toBeNull();
    expect(host.querySelector('h2')?.textContent).toBe('Block 1');
    const trigger=host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
    await act(async()=>trigger.click());
    const dialog=document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Go to block');
    const input=dialog.querySelector<HTMLInputElement>('input')!;
    expect(input.inputMode).toBe('numeric');
    input.value='147';
    await act(async()=>dialog.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(push).toHaveBeenCalledWith("/quests/towers/class_skill?block=147&from=%2Fquests%2Ftowers%3Fq%3Dskill#block-reader", { scroll: true });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("rejects invalid and missing block numbers and uses actual neighboring blocks", async()=>{
    const host=await render(<TowerBlockControls id="challenge_saga" current={3} numbers={[1,3,6]}/>);
    expect(host.textContent).toContain('3 blocks');
    expect(host.querySelector('a[aria-label="Previous block, 1"]')?.getAttribute('href')).toBe('/quests/towers/challenge_saga?block=1#block-reader');
    expect(host.querySelector('a[aria-label="Next block, 6"]')?.getAttribute('href')).toBe('/quests/towers/challenge_saga?block=6#block-reader');
    await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
    const dialog=document.querySelector('[role="dialog"]')!,input=dialog.querySelector<HTMLInputElement>('input')!;
    for(const value of ['0','2','3.5','999','']){
      input.value=value;await act(async()=>dialog.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
      expect(push).not.toHaveBeenCalled();expect(dialog.querySelector('[role="alert"]')).not.toBeNull();
    }
  });
  it("disables boundary navigation and keeps the footer free of another selector",async()=>{
    const host=await render(<TowerBlockControls id="event_ggsfa1" current={1} numbers={[1,2]}/>);
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Previous block"]')?.disabled).toBe(true);
    await act(async()=>root!.render(<TowerBlockControls id="event_ggsfa1" current={2} numbers={[1,2]} compact/>));
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Next block"]')?.disabled).toBe(true);
    expect(host.querySelector('select,input,h2')).toBeNull();
    expect(host.querySelector('a[href="#block-reader"]')).not.toBeNull();
  });
  it("shows one real Challenge Tower without fabricated archive entries or a speculative status filter", async () => {
    const t: TowerCatalogEntry = { id: "challenge_saga", name: "SAGA SHOWCASE TOWER", section: "challenge", archiveStatus: "unknown", artwork: null, blockNumbers: [1, 2, 3, 4, 5, 6], floorCount: 44 };
    const host = await render(<TowerCatalog towers={[t]} query="" section="challenge" status=""/>);
    expect(host.textContent).toContain("1 Tower"); expect(host.textContent).not.toContain("1 Towers");
    expect(host.querySelector('select[name="status"]')).toBeNull();
    expect(host.querySelectorAll('a[href*="/quests/towers/challenge_saga"]')).toHaveLength(1);
    expect(host.querySelector("h3")?.textContent).toBe("Saga Showcase Tower");
    expect(host.textContent).not.toContain("About this Tower collection");
  });
  it("distinguishes unidentified nodes without exposing source IDs", async () => {
    const f = floor(); f.modifiers = ["raw-one", "raw-two"].map(id => ({ id, name: "Recorded modifier", description: null, iconKey: null, quantity: 1 }));
    const host = await render(<TowerFloors floors={[f]}/>);
    const summaries = [...host.querySelectorAll("article ul > li > details > summary")].map(e => e.textContent);
    expect(summaries[0]).toContain("Unidentified modifier 1");
    expect(summaries[1]).toContain("Unidentified modifier 2");
    expect(host.textContent).not.toMatch(/raw-one|raw-two|Definition details/);
  });
  it("retains separate unknown rating quantities and labels unresolved identities explicitly", async () => {
    const host = await render(<TowerRewards rewards={["twr", "tmu"].map(token => ({ key: token, scope: "Rating rewards", name: "Rating reward", token, quantity: 1, type: "item", sourceType: "gsi", imageUrl: null, href: null }))}/>);
    expect(host.textContent).toContain("Rating reward details unavailable");
    expect([...host.querySelectorAll("ol > li > strong")].map(e => e.textContent)).toEqual(["\u00d71", "\u00d71"]);
    expect(host.querySelector("details")?.open).toBe(false);
    expect(host.querySelector("summary")?.textContent).toContain("2 records");
    expect(host.textContent).not.toMatch(/gsi\/twr|gsi\/tmu|Source item/);
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
