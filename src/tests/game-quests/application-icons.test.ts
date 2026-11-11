import { expect,it } from "vitest";
import { loadQuestMap, findQuest } from "../../data/game-quests";
import { permanentData, getBossPreview } from "../../data/game-quests/permanent";
import { withApplicationIcons } from "../../data/game-quests/application-icons";
import { resolveNativeModifierIcon } from "../../domain/node-modifiers/native-icons";
import ledger from "../../data/game-quests/application-icons.json";

it("binds exact source/application/version and rejects source/effect drift",async()=>{
  const map=(await loadQuestMap("a05_ch01_q01"))!;
  const a=map.tiles.flatMap(t=>t.applications).find(a=>a.iconKey)!;
  const record=ledger.maps.a05_ch01_q01.applications;
  expect(record[a.id as keyof typeof record].versionHash).toMatch(/^[a-f0-9]{64}$/);
  expect(a).not.toHaveProperty("definitionVersionHash");
  expect(resolveNativeModifierIcon(a.iconKey)).toBeDefined();
  const stale=withApplicationIcons({...map,sourceHash:"changed"});
  expect(stale.tiles.flatMap(t=>t.applications).every(a=>a.iconKey===null)).toBe(true);
  expect(withApplicationIcons({...map,mapId:"wrong-map"}).tiles.flatMap(t=>t.applications).every(a=>a.iconKey===null)).toBe(true);
  const changed=structuredClone(map);const altered=changed.tiles.flatMap(t=>t.applications).find(b=>b.id===a.id)!;altered.effectId="another-effect";
  expect(withApplicationIcons(changed).tiles.flatMap(t=>t.applications).find(b=>b.id===a.id)?.iconKey).toBeNull();
  const refreshed=(await loadQuestMap("eq_legends_e"))!;
  // This saved Realm layout has no tile modifier assignments; do not invent any.
  expect(refreshed.tiles.flatMap(t=>t.applications)).toHaveLength(0);
  const newMap=(await loadQuestMap("me_crucible_ch02_q02"))!;
  const native=newMap.tiles.flatMap(t=>t.applications).find(a=>a.iconKey)!;
  expect(native).toBeDefined();expect(resolveNativeModifierIcon(native.iconKey)).toBeDefined();
  expect(withApplicationIcons({...newMap,sourceHash:"drift"}).tiles.flatMap(t=>t.applications).every(a=>!a.iconKey)).toBe(true);
});

it("retains multiple explicit boss previews and native NPC art without playable aliases",()=>{
  expect(Object.values(permanentData.bossPreviews).some(p=>p.bosses.length>1)).toBe(true);
  const p=permanentData.bossPreviews.a04_ch04_q06;
  expect(p.catalogSourceHash).toBe(findQuest("a04_ch04_q06")?.sourceHash);
  const q=findQuest("a04_ch04_q06")!;
  expect(getBossPreview({...q,mapId:"wrong-map"})).toBeUndefined();
  expect(getBossPreview({...q,containerSetId:"wrong-set"})).toBeUndefined();
  const npc=p.bosses.find(b=>b.gameId==="maestro")!;
  expect(npc.champion).toBeNull();
  expect(permanentData.nativePortraits.maestro.url).toMatch(/^\/game-quests\/permanent-art\//);
  expect(permanentData.towers).toHaveLength(6);
  expect(permanentData.towers.every(t=>t.category==="Class" && !("NumFloors" in t))).toBe(true);
});
