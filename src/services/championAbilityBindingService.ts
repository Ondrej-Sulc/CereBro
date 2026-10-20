import type { ChampionAbilityTextTemplate, ChampionAbilityTextTemplateNode, ChampionAbilityTextTemplateValueSource } from '../domain/champion-ability-text/types';
import { readGameDisplayBinding } from '../domain/champion-ability-text/game-binding';
import type { AbilityDisplayRow } from './championAbilityDisplayService';
import { artifactHash } from '../domain/champion-effect-enrichment';

type Source = Extract<ChampionAbilityTextTemplateValueSource, { kind: 'abilityParam' }>;
export type AbilityBindingEntry = { gameId: string; sourceId: string; componentId: string; hudId: string; bindingComponentIds: string[]; raw: string; sources: Record<string, Source> };
export type AbilityBindingFile = { schemaVersion: 1; contract: 'GameUtils.GetFormattedLocalizedBuff/v1'; provenance: Record<string, string>; entries: AbilityBindingEntry[]; held: unknown[] };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const key = (gameId: string | null, sourceId: string) => JSON.stringify([gameId, sourceId]);

export function parseAbilityBindingFile(text: string): AbilityBindingFile {
  const data = JSON.parse(text) as AbilityBindingFile;
  if (data.schemaVersion !== 1 || data.contract !== 'GameUtils.GetFormattedLocalizedBuff/v1'
    || !object(data.provenance) || !['schema', 'bcg', 'descriptions', 'debug'].every(k => typeof data.provenance[k] === 'string' && /^[a-f0-9]{64}$/.test(data.provenance[k]))
    || !Array.isArray(data.entries) || !Array.isArray(data.held)) throw Error('Invalid game binding file.');
  const seen = new Set<string>();
  for (const entry of data.entries) {
    if (!object(entry) || !(['gameId', 'sourceId', 'componentId', 'hudId', 'raw'] as const).every(k => typeof entry[k] === 'string')
      || !object(entry.sources) || !Array.isArray(entry.bindingComponentIds) || !entry.bindingComponentIds.length
      || new Set(entry.bindingComponentIds).size !== entry.bindingComponentIds.length
      || !entry.bindingComponentIds.every(id => typeof id === 'string' && !!id)) throw Error('Invalid game binding entry.');
    const id = key(entry.gameId, entry.sourceId);
    if (seen.has(id)) throw Error('Duplicate game binding identity.');
    seen.add(id);
    const indices = [...new Set([...entry.raw.matchAll(/\{(\d+)\}/g)].map(m => m[1]))].sort();
    if (JSON.stringify(indices) !== JSON.stringify(Object.keys(entry.sources).sort())) throw Error('Incomplete game binding slots.');
    for (const [index, source] of Object.entries(entry.sources)) {
      const binding = readGameDisplayBinding(source.gameBinding);
      if (source.kind !== 'abilityParam' || !entry.bindingComponentIds.includes(source.componentId ?? '') || binding.slot !== Number(index)
        || source.rawValue !== binding.value) throw Error('Game binding source differs.');
    }
  }
  return data;
}

/** Replace only parameter sources; source text, markup, display metadata and IDs stay intact. */
export function attachAbilityBindings<T extends ChampionAbilityTextTemplate>(template: T, entry?: AbilityBindingEntry): T {
  if (!entry) return template;
  if (entry.raw !== template.raw) throw Error('Game binding raw text differs.');
  const counts = new Set<string>();
  const visit = (nodes: ChampionAbilityTextTemplateNode[]): ChampionAbilityTextTemplateNode[] => nodes.map(node => {
    if (node.type === 'color') return { ...node, children: visit(node.children) };
    if (node.type !== 'value') return node;
    const source = entry.sources[String(node.placeholderIndex)];
    if (!source) throw Error('Game binding slot missing from template.');
    counts.add(String(node.placeholderIndex));
    return { ...node, source };
  });
  if (!template.blocks) throw Error('Game binding template has no blocks.');
  const result = { ...template, blocks: template.blocks.map(b => ({ ...b, children: visit(b.children) })) };
  if (counts.size !== Object.keys(entry.sources).length) throw Error('Game binding template coverage differs.');
  return result;
}

export function planAbilityBindingUpdates(rows: AbilityDisplayRow[], entries: AbilityBindingEntry[]) {
  const bySource = new Map(entries.map(e => [key(e.gameId, e.sourceId), e]));
  const updates: Array<{ id: number; before: unknown; after: ChampionAbilityTextTemplate }> = [];
  const held: Array<{ id: number; championId: number; sourceId: string; reason: string }> = [];
  let unchanged = 0;
  for (const row of rows) {
    if (!object(row.template) || typeof row.template.raw !== 'string' || !/\{\d+\}/.test(row.template.raw)) continue;
    const entry = bySource.get(key(row.gameId, row.sourceId));
    const display = row.template.display;
    if (!entry || row.template.raw !== entry.raw || !object(display)
      || display.componentId !== entry.componentId || display.hudId !== entry.hudId) {
      held.push({ id: row.id, championId: row.championId, sourceId: row.sourceId, reason: !entry ? 'no-exact-game-binding' : 'raw-or-component-identity-differs' });
      continue;
    }
    const before = row.template as ChampionAbilityTextTemplate;
    const after = attachAbilityBindings(before, entry);
    if (artifactHash(before) === artifactHash(after)) unchanged++;
    else updates.push({ id: row.id, before, after });
  }
  return { updates, held, unchanged };
}
