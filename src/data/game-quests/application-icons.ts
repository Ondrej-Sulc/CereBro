import raw from "./application-icons.json";
import { expandedApplicationIcons as expanded } from "./expanded-icons.js";
import { questNativeIconsV2 } from "./v2-icons.js";
import { questNativeIconsV3 } from "./v3-icons.js";
import { resolveNativeGameModifierIcon } from "../../domain/node-modifiers/native-game-icons";
import { nativeModifierHref } from "../game-node-modifiers/links";
import type { QuestMap } from "../../domain/game-quests";
type Ledger = { maps: Record<string,{mapId:string;sourceHash: string; applications: Record<string,{effectId?: string; iconKey: string; versionHash: string}>}> };
const baseBcg = (raw as unknown as { bcgSha256: string }).bcgSha256;
const expandedLedger = expanded as Ledger & { bcgSha256: string };
const ledger:Ledger = {maps:{...(raw as unknown as Ledger).maps,...(expanded as unknown as Ledger).maps}};
type AdditiveLedger={bcgSha256:string;proofs:{effectId:string;iconKey:string;versionHash:string}[];maps:Record<string,{mapId:string;sourceHash:string;applications:Record<string,number>}>};
const additive=questNativeIconsV2 as AdditiveLedger;
const nativeExtension=questNativeIconsV3 as AdditiveLedger;
/** Server projection only. The client receives icon keys and verified page URLs, without source versions or catalogs. */
export function withApplicationIcons(map: QuestMap): QuestMap {
  const record = ledger.maps[map.questId];
  const extra=additive.maps[map.questId];
  const extension=nativeExtension.maps[map.questId];
  return { ...map, tiles: map.tiles.map(t => ({ ...t, applications: t.applications.map(a => {
    const addedIndex=extra?.sourceHash===map.sourceHash&&extra.mapId===map.mapId?extra.applications[a.id]:undefined;
    const nativeIndex=extension?.sourceHash===map.sourceHash&&extension.mapId===map.mapId?extension.applications[a.id]:undefined;
    const binding = nativeIndex!==undefined?nativeExtension.proofs[nativeIndex]:addedIndex!==undefined?additive.proofs[addedIndex]:record?.sourceHash === map.sourceHash && record.mapId===map.mapId ? record.applications[a.id] : undefined;
    const icon = binding && binding.effectId === a.effectId ? resolveNativeGameModifierIcon(binding.iconKey) : undefined;
    const bcg = nativeIndex !== undefined ? nativeExtension.bcgSha256 : addedIndex !== undefined ? additive.bcgSha256 : expandedLedger.maps[map.questId] ? expandedLedger.bcgSha256 : baseBcg;
    const definitionHref = binding?.effectId === a.effectId ? nativeModifierHref(a.effectId, binding.versionHash, bcg) : null;
    return { ...a, iconKey: icon?.key ?? null, definitionHref };
  }) })) };
}
