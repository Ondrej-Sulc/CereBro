export type { TowerCatalogEntry, TowerBlockView, TowerFloorView, TowerModifierView } from "./types";
export { getTowerCatalog, getTowerBlockView } from "./reader";
/** Reward views already contain their friendly Tower scope. */
export function towerRewardScope(scope: string): string { return scope; }
