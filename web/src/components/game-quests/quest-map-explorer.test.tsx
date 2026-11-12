// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadQuestMap } from "../../../../src/data/game-quests";
import { QuestMapExplorer } from "./quest-map-explorer";
import { ChampionQuestEncounterLink } from "./champion-quest-encounter-link";
import { QuestRewards } from "./quest-rewards";
import { QuestApplicationDetails } from "./quest-application-details";
import { QuestProvenance } from "./quest-provenance";
vi.mock("next/link", () => ({ default: ({ href, children, prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => { void prefetch; return <a href={href} {...props}>{children}</a>; } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
HTMLElement.prototype.scrollBy = vi.fn();
HTMLElement.prototype.scrollTo = vi.fn();
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); document.body.innerHTML = ""; });
async function render(element: React.ReactNode) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(element));
  return host;
}
describe("quest map controls", () => {
  it("opens encounter modifier descriptions by default and keeps the selected defender compact", async () => {
    const map = (await loadQuestMap("me_crucible_ch01_q01"))!;
    const host = await render(<QuestMapExplorer map={map} initialNode="27,18" />);
    const inspector = host.querySelector('section[aria-labelledby="coordinate-heading"]')!;
    const modifiers = [...inspector.querySelectorAll<HTMLDetailsElement>('[data-quest-application]')];
    expect(modifiers).toHaveLength(9);
    expect(modifiers.every(modifier => modifier.open)).toBe(true);
    expect(inspector.querySelector('h2')?.textContent).toContain("Crossbones");
    expect([...inspector.querySelectorAll('h2,h3')].filter(h => h.textContent?.includes("Crossbones"))).toHaveLength(1);
    expect(inspector.textContent).not.toMatch(/Selected location|Recorded build|Defender data|Local · defender/);
    expect(inspector.textContent).toContain("Node modifiers");
    const connections = inspector.querySelector<HTMLDetailsElement>('[data-map-connections]')!;
    expect(connections.open).toBe(false);
    expect(modifiers.at(-1)!.compareDocumentPosition(connections) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hides routine modifier metadata while retaining linked sources, attacker labels and sharing", async () => {
    const map = (await loadQuestMap("a05_ch01_q01"))!;
    const application = map.tiles.flatMap(t => t.applications)[0];
    const choose = vi.fn();
    const host = await render(<QuestApplicationDetails application={{ ...application, sourceType:"Local",target:"defender",amount:1,remainActive:false,linkedTargets:[] }} questId={map.questId} sourceHash={map.sourceHash} shareUrl="/quests/a05_ch01_q01?path=0" choose={choose}/>);
    expect(host.querySelector<HTMLDetailsElement>('[data-quest-application]')?.open).toBe(true);
    expect(host.querySelector('[data-modifier-context]')).toBeNull();
    expect(host.querySelector('summary')?.textContent).not.toMatch(/Local|defender/);
    await act(async () => root!.render(<QuestApplicationDetails application={{...application,sourceType:"Link",target:"attacker"}} questId={map.questId} sourceHash={map.sourceHash} shareUrl="/quests/a05_ch01_q01?path=0" choose={choose}/>));
    expect(host.querySelector('summary')?.textContent).toContain("Linked");
    expect(host.querySelector('summary')?.textContent).toContain("Attacker");
    expect(host.querySelector<HTMLDetailsElement>('[data-modifier-context]')?.open).toBe(false);
    const source = [...host.querySelectorAll('button')].find(b=>b.textContent?.includes("Source location"))!;
    await act(async()=>source.click());
    expect(choose).toHaveBeenCalledWith(application.sourceCoordinate,true);
    const share = host.querySelector<HTMLAnchorElement>('a[aria-label^="Link to "]')!;
    expect(new URL(share.href).searchParams.get('application')).toBe(application.id);
    expect(new URL(share.href).searchParams.get('sourceHash')).toBe(map.sourceHash);
    expect(host.textContent).not.toContain(map.sourceHash);
    await act(async () => root!.render(<QuestApplicationDetails application={{...application,sourceType:"Global",target:"defender"}} questId={map.questId} sourceHash={map.sourceHash} shareUrl="/quests/a05_ch01_q01?path=0" choose={choose}/>));
    expect(host.querySelector('summary')?.textContent).toContain("Global");
    expect(host.querySelector('summary')?.textContent).not.toContain("defender");
  });

  it("renders saved native description line breaks without changing source text", async () => {
    const map = (await loadQuestMap("me_mausoleum_ch01_q01"))!;
    const application = map.tiles.flatMap(t => t.applications).find(a => a.id === "4,4:defender:10")!;
    const nativeDescription = application.description!;
    expect(nativeDescription).toContain("\\nThe Attacker");
    const host = await render(<QuestApplicationDetails application={application} questId={map.questId} sourceHash={map.sourceHash} shareUrl="/quests/me_mausoleum_ch01_q01" initialOpen choose={() => {}} />);
    const description = host.querySelector("details > p")!.textContent!;
    expect(description).toContain("Nodes.\nThe Attacker");
    expect(description).not.toContain("\\n");
    expect(description).not.toContain("[fcf000]");
    expect(application.description).toBe(nativeDescription);
  });
  it("renders the actual unresolved-component application with missing native description without guessing an icon",async()=>{
    const map=(await loadQuestMap("a06_ch02_q05"))!;
    const application=map.tiles.flatMap(t=>t.applications).find(a=>a.id==="11,11:defender:1")!;
    expect(application.description).toBeNull();expect(application.iconKey).toBeNull();
    const host=await render(<QuestApplicationDetails application={application} questId={map.questId} sourceHash={map.sourceHash} shareUrl="/quests/a06_ch02_q05?node=11%2C11" initialOpen choose={()=>{}}/>);
    expect(host.querySelector('summary')?.textContent).toContain("Like Old Days");
    expect(host.textContent).toContain("Description unavailable for this saved application.");
    expect(application.effectId).toBe("pve_ragthor_sb3");
    expect(host.textContent).not.toContain(application.effectId);expect(host.querySelector('[data-game-modifier-icon]')).toBeNull();
    expect(host.textContent).not.toContain("11,11");
  });
  it("keeps non-champion reward types and native quantity ranges truthful in public source data",async()=>{
    const host=await render(<QuestProvenance rewards={[{key:"fragments",scope:"masteryCompletionRewards",token:"exact-token",sourceType:"gf",type:"item",name:"Crystal shards",quantity:1,amount:"5–10",imageUrl:null,href:null}]}/>);
    expect(host.textContent).toContain("gf/exact-token 5–10");
    expect(host.textContent).not.toContain("hero/exact-token");
  });
  it("accumulates rapid wheel input and keeps source coordinates out of public text and labels",async()=>{
    const map=(await loadQuestMap("a05_ch01_q01"))!;
    const host=await render(<QuestMapExplorer map={map} initialNode="10,21"/>);
    const viewport=host.querySelector('[aria-label="Scrollable quest map"]')!;
    const initialScale=Number(host.querySelector('[data-zoom]')?.getAttribute('data-zoom'));
    await act(async()=>{viewport.dispatchEvent(new WheelEvent("wheel",{deltaY:-100,bubbles:true,cancelable:true}));viewport.dispatchEvent(new WheelEvent("wheel",{deltaY:-100,bubbles:true,cancelable:true}));});
    expect(Number(host.querySelector('[data-zoom]')?.getAttribute('data-zoom'))).toBeCloseTo(initialScale*Math.exp(.4));
    expect(host.textContent).not.toMatch(/\b10,\s*21\b/);
    expect(host.textContent).not.toContain("Route position");
    expect(host.querySelector('[aria-label="Route position"]')).toBeNull();
    expect([...host.querySelectorAll('title,[aria-label]')].every(e=>!(/\b\d+,\s*\d+\b/.test(e.getAttribute('aria-label')??e.textContent??'')))).toBe(true);
    expect(host.querySelector('a[href*="node=10%2C21"]')).not.toBeNull();
  });
  it("makes a final-boss-only saved preview explicit without inventing other placements", async () => {
    const map = (await loadQuestMap("realm3"))!;
    const host = await render(<QuestMapExplorer map={map} />);
    expect(host.querySelector('[data-encounter-coverage]')?.textContent).toContain("only the final-boss placement");
    expect(host.querySelectorAll('[data-map-encounter]')).toHaveLength(1);
    expect(host.querySelector('[aria-label="Recorded routes"] option')?.textContent).toBe("Route 1 · 1 fight");
    expect(map.paths).toHaveLength(20);
  });
  it("shows native application labels without color markup while preserving source text", async () => {
    const map = (await loadQuestMap("me_pain2024_fin_quest"))!;
    const application = map.tiles.flatMap(t => t.applications).find(a => a.name === "[fcf000]Superiority:[-] Paragon")!;
    expect(application).toBeDefined();
    const host = await render(<QuestApplicationDetails application={application} questId={map.questId} sourceHash={map.sourceHash} shareUrl="/quests/me_pain2024_fin_quest?node=12,32" initialOpen={false} choose={() => {}} />);
    expect(host.querySelector("summary")?.textContent).toContain("Superiority: Paragon");
    expect(host.querySelector("summary")?.textContent).not.toContain("[fcf000]");
    expect(application.name).toBe("[fcf000]Superiority:[-] Paragon");
  });
  it("selects actual placed defenders, preserves shared paths and changes route", async () => {
    const map = (await loadQuestMap("a05_ch01_q01"))!;
    const host = await render(<QuestMapExplorer map={map} initialPath="0" initialNode="10,21" />);
    expect(host.querySelector('[data-encounter-coverage]')).toBeNull();
    expect(host.textContent).toContain("Gambit");
    expect(host.textContent).toContain("Ability Accuracy is increased by 20%");
    const route = host.querySelector<HTMLSelectElement>('[aria-label="Recorded routes"]')!;
    await act(async () => { route.value = "2"; route.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).toContain("Route 3 · Encounter order");
    expect(host.textContent).toContain("8 fights on this recorded route");
    const zoom = host.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!;
    await act(async () => zoom.click());
    expect(Number(host.querySelector("svg[data-zoom]")?.getAttribute("data-zoom"))).toBeGreaterThan(1);
    expect(host.querySelectorAll("[data-map-encounter]")).toHaveLength(map.encounters.length);
  });
  it("ignores invalid route/coordinate links and keeps an NPC unlinked", async () => {
    const map = (await loadQuestMap("a04_ch04_q06"))!;
    const host = await render(<QuestMapExplorer map={map} initialPath="99" initialNode="24,1" />);
    expect(host.querySelector<HTMLSelectElement>('[aria-label="Recorded routes"]')?.value).toBe("0");
    expect(host.textContent).toContain("NPC / legacy defender");
    expect(host.querySelector('[data-quest-portrait="fallback"]')).not.toBeNull();
    expect(host.querySelector('a[href="/champions/maestro"]')).toBeNull();
    expect(host.querySelector('a[href*="node=24%2C1"]')).not.toBeNull();
  });
  it("offers exact gameId lookup outside acquisition, without loading a catalog", async () => {
    const host = await render(<ChampionQuestEncounterLink gameId="punisher_legacy" />);
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/quests/encounters?gameId=punisher_legacy");
    expect(host.textContent).toContain("as an opponent");
    await act(async () => root!.render(<ChampionQuestEncounterLink gameId={null} />));
    expect(host.querySelector("a")).toBeNull();
  });
  it("uses exact portraits and native NPC art without playable aliases", async () => {
    const map = (await loadQuestMap("a04_ch04_q06"))!;
    const portraits = { hulk: { name: "Hulk", href: "/champions/hulk", imageUrl: "https://example.com/hulk.png", className: "Science", color: "green" }, maestro: { name: "Wrong guess", href: "/champions/maestro", imageUrl: "https://example.com/wrong.png", className: "Science", color: "green" } };
    const host = await render(<QuestMapExplorer map={map} portraits={portraits} initialNode="24,1" />);
    expect(host.querySelectorAll('[data-quest-portrait="resolved"]').length).toBeGreaterThan(0);
    expect(host.textContent).not.toContain("Wrong guess");
    expect(host.querySelector('img[src*="wrong"]')).toBeNull();
    expect(host.textContent).toContain("Science");
    expect(host.querySelector('[data-map-portrait="hulk"]')).not.toBeNull();
    expect(host.querySelector('[data-map-portrait="maestro"]')).toBeNull();
    const boss = host.querySelector<SVGGElement>('[data-map-encounter*="finalBossID"]')!;
    await act(async () => boss.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(boss.getAttribute("aria-pressed")).toBe("true");
    await act(async () => root!.render(<QuestMapExplorer map={map} initialNode="24,1" portraits={{...portraits,maestro:{name:"MAESTRO",href:null,imageUrl:"/game-quests/permanent-art/verified.webp",className:"NPC / legacy defender",color:"gray",nativeGameId:"maestro"}}}/>));
    expect(host.querySelector('[data-map-portrait="maestro"]')).not.toBeNull();
    expect(host.querySelector('a[href="/champions/maestro"]')).toBeNull();
  });
  it("shows only relevant reward scopes with readable exact destinations", async () => {
    const host = await render(<QuestRewards rewards={[{ key: "one", name: "MYTHIC CRYSTAL", scope: "masteryCompletionRewards", token: "mythic_shard_crystal", type: "crystal", quantity: 1, href: "/crystals/mythic_shard_crystal", imageUrl: null }]} />);
    expect(host.textContent).toContain("100% exploration");
    expect(host.textContent).not.toContain("Fixed champion rewards");
    expect(host.querySelector("li > div > p")?.textContent).not.toContain("mythic_shard_crystal");
    expect(host.querySelector('a')?.getAttribute("href")).toBe("/crystals/mythic_shard_crystal");
    await act(async () => root!.render(<QuestRewards rewards={[]} />));
    expect(host.textContent).toBe("");
  });
});
