import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ArtworkDiscovery, loadArtworkDiscovery, normalizeArtworkQuery } from "./discovery";
import { parseFilters } from "./contract";

const directory = path.resolve("web/src/lib/game-artwork");
const projection = JSON.parse(readFileSync(path.join(directory,"generated/discovery-v1.json"),"utf8"));
const discovery = new ArtworkDiscovery(projection);
const search = (query: string) => discovery.search(parseFilters(new URLSearchParams(query)));
const doom = "afb83968e8c193c440a924722407630da6314f3b243a86d1b7c03381e9ad68b5";
const nexus = "16be59b8e077f0a83594d561deb1eb2907d8f3d470d3f41b12d23c89f35e5482";
const catalyst = "9a53610e7bcd4575381494868477e1f7900bb9271008e2618e3e131b8a104ca9";

describe("real catalog discovery retrieval",()=>{
  it("normalizes packed ISO-8 names without Isophyne or short-hash noise",()=>{
    const packed=search("q=iso8&family=crystals&evidence=registry");
    expect(packed.total).toBeGreaterThan(0);
    expect(packed.items.map(a=>a.id)).toEqual(search("q=ISO-8&family=crystals&evidence=registry").items.map(a=>a.id));
    expect(search("q=iso8").items.map(a=>a.id)).toEqual(search("q=ISO-8").items.map(a=>a.id));
    expect(search("q=bc").items.some(a=>a.match?.label==="Catalog asset ID")).toBe(false);
    expect(search("q=bc").items.some(a=>/^[a-f0-9]{32,}(?:\.[a-z0-9]+)?$/iu.test(a.match?.label ?? ""))).toBe(false);
    expect(search("q=afb83968").items.map(a=>a.id)).toContain(doom);
    expect(search("q=AFB83968").items.map(a=>a.id)).toContain(doom);
  });
  it("keeps Goldpool portraits and gold VFX out of Currencies, and VFX splashes out of Backgrounds",()=>{
    expect(discovery.detail("30350a899f7fb469a492a0ef89f131b7de90a07298da6592bc7c10768daca385").families).not.toContain("currencies");
    expect(discovery.detail("4bcbc5dfa69f3110b157f1bcd7885e8533ae6da411501a88d4973a32ab3127f5").families).not.toContain("currencies");
    const splash=discovery.detail("1958d903c564926b64ce0b4aec5dcf4c5d262c41ec623e673757d9a4f8acc765");
    expect(splash.families).toContain("materials");
    expect(splash.families).not.toContain("currencies"); expect(splash.families).not.toContain("backgrounds");
    expect(search("family=backgrounds&q=Splash_background").total).toBeGreaterThan(0);
  });
  it("includes every retained gatchacrystal texture as a native crystal usage hint",()=>{
    const all=search("q=gatchacrystal&pageSize=96");
    expect(all.total).toBe(66);
    expect(search("q=gatchacrystal&family=crystals&pageSize=96").items.map(a=>a.id)).toEqual(all.items.map(a=>a.id));
    expect(all.items.every(a=>a.families?.includes("crystals"))).toBe(true);
  });
  it.each(["Doctor Doom","Dr. Doom","DoctorDoom","doctor_doom","doctor-doom"])("ranks the actual native Doctor Doom portrait first for %s",query=>{
    const result=search(`q=${encodeURIComponent(query)}`);
    expect(result.items[0]).toMatchObject({id:doom,match:{basis:"native-id",label:"Doctor Doom"}});
    expect(result.items[0].name).toBe("portrait_doctordoom.png");
  });
  it("recovers an anonymous cache PNG using its exact recorded Grandmaster Nexus registry use",()=>{
    const result=search("q=Grandmaster%20Nexus&family=crystals&evidence=registry&kind=loose&minWidth=256&maxWidth=256&minHeight=256&maxHeight=256");
    expect(result.items.map(a=>a.id)).toContain(nexus);
    expect(result.items[0].name).toBe("031089AF1443DD41715FCA9465FD79B87742D546.png");
    expect(discovery.detail(nexus).identities).toContainEqual(expect.objectContaining({basis:"registry",label:"GRANDMASTER NEXUS CRYSTAL",domain:"crystal"}));
  });
  it("finds Old Man Logan through canonical-name initials and Gold through the canonical resource display map",()=>{
    expect(search("q=OML&family=portraits").items.map(a=>a.id)).toContain("bea5cb4475a20fc3bfcb204958e88dae7b1d642830589ac35449219e2e9d855a");
    const gold=search("q=Gold&family=currencies&evidence=registry");
    expect(gold.items.some(a=>a.match?.label==="Gold")).toBe(true);
  });
  it("finds the real Tier 5 Basic Catalyst and fragment via the recorded abbreviation, excluding DXT5 BC3 textures",()=>{
    const result=search("q=T5BC");
    expect(result.total).toBe(2);
    expect(result.items[0]).toMatchObject({id:catalyst,match:{basis:"registry",label:"TIER 5 BASIC CATALYST"}});
    expect(result.items.every(a=>!a.name.includes("DXT5"))).toBe(true);
    expect(search("q=Tier%205%20Basic%20Catalyst&family=catalysts").items.map(a=>a.id)).toContain(catalyst);
  });
  it("keeps native Tower UI separate from a champion's model prop and never guesses a Bleed PNG identity",()=>{
    const result=search("q=tower&family=quests");
    expect(result.items.map(a=>a.id)).toContain("d81154aa90a0ee5e5027409a33ba03d9277fa1221cfd012cc16f8a8652faad70");
    expect(result.items.some(a=>a.name.includes("BoxGloveAndTower"))).toBe(false);
    expect(result.total).toBeLessThan(20); // The broad family label must not make every quest image a Tower match.
    expect(search("q=Bleed&evidence=registry").total).toBe(0);
  });
  it("does not turn every gacha prize portrait into a crystal browse result",()=>{
    const crystals=search("family=crystals");
    expect(crystals.items.some(a=>a.name==="GachaChasePrize_256x256_abomination.png")).toBe(false);
    expect(search("q=Doctor%20Doom&family=crystals&evidence=native-id").total).toBe(0);
  });
  it("does not classify Signature Ability Crystal artwork as an effect icon",()=>{
    expect(search("family=combat&q=Signature%20Ability%20Crystal").total).toBe(0);
    expect(search("family=crystals&q=Signature%20Ability%20Crystal").items.map(a=>a.id)).toContain("2a93e3c1bc1d338d2e9b3fd6b656594e00e06d82d73dcc599be983387944b4fc");
  });
  it("preserves all 10,049 assets through stable pages and exposes overlapping distinct-asset family counts",()=>{
    const ids:string[]=[];
    for(let page=1;page<=105;page++)ids.push(...search(`page=${page}&pageSize=96`).items.map(a=>a.id));
    expect(ids).toHaveLength(10049); expect(new Set(ids).size).toBe(10049);
    const all=search("");
    expect(all.families.find(f=>f.id==="unclassified")?.count).toBe(3269);
    expect(search("family=unclassified").total).toBe(3269);
    expect(all.families.reduce((sum,f)=>sum+f.count,0)).toBeGreaterThan(10049);
    expect(search("page=99999").page).toBe(210);
  });
  it("retains shared/tinted registry use notes instead of asserting a repainted class identity",()=>{
    const raw=projection.assets.find((a:{identities:{note:string}[]})=>a.identities.some(i=>i.note.includes("not the tinted/composited output")));
    expect(raw).toBeDefined();
    expect(discovery.detail(raw.id).identities?.some(i=>i.note.includes("base artwork"))).toBe(true);
  });
  it("binds the projection to exact current repository inputs and rejects malformed filters",()=>{
    expect(projection.inputs["catalog.sqlite"]).toBe("205db640ce69f268f7bfd93dcb574b0fe018980727d163e5ae09fbf38dd68f02");
    for(const [file,hash] of Object.entries(projection.inputs)) {
      if(!file.startsWith("src/"))continue;
      expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(hash);
    }
    for(const query of ["family=guess","evidence=verified","family=items&family=quests"])expect(()=>parseFilters(new URLSearchParams(query))).toThrow();
    expect(normalizeArtworkQuery("Spider-Man (StarkEnhanced)")).toBe("spider man stark enhanced");
  });
  it("does not apply stale or missing sidecars to another catalog",()=>{
    vi.stubEnv("GAME_ARTWORK_SEARCH_INDEX",path.join(directory,"generated/discovery-v1.json"));
    expect(loadArtworkDiscovery(path.join(directory,"contract.ts"),10049)).toBeUndefined();
    vi.stubEnv("GAME_ARTWORK_SEARCH_INDEX",path.join(directory,"missing-index.json"));
    expect(loadArtworkDiscovery(path.join(directory,"contract.ts"),10049)).toBeUndefined();
    vi.unstubAllEnvs();
  });
  it("keeps page caches separate across kind, evidence, source and dimension filters",()=>{
    const a=search("q=Doctor%20Doom&kind=loose&family=portraits&evidence=native-id&source=installed&minWidth=256&maxWidth=256&minHeight=256&maxHeight=256");
    expect(a.total).toBe(2);
    expect(search("q=Doctor%20Doom&kind=texture&family=portraits&evidence=native-id").total).toBe(0);
    expect(search("q=Doctor%20Doom&kind=loose&family=portraits&evidence=native-id&minWidth=512").total).toBe(0);
    expect(search("q=Doctor%20Doom&kind=loose&family=portraits&evidence=native-id&source=absent").total).toBe(0);
    expect(search("q=Doctor%20Doom&kind=loose&family=portraits&evidence=native-id&source=installed&minWidth=256&maxWidth=256&minHeight=256&maxHeight=256&pageSize=1&page=2").items).toHaveLength(1);
    expect(a.items).toHaveLength(2);
  });
});
