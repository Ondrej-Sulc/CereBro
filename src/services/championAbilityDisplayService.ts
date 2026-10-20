import { readAbilityTextDisplay } from '../domain/champion-ability-text/display';
import type { ChampionAbilityTextDisplay } from '../domain/champion-ability-text/types';
import { artifactHash } from '../domain/champion-effect-enrichment';

export type AbilityDisplayEntry = { gameId: string; sourceId: string; raw: string; display: ChampionAbilityTextDisplay };
export type AbilityDisplayRow = { id: number; championId: number; gameId: string | null; sourceId: string; template: unknown };
export type AbilityDisplayFile = { schemaVersion: 1; provenance: Record<string, string>; entries: AbilityDisplayEntry[] };
export type AbilityDisplayChampionBinding = { championId: number; gameId: string; sourceRowsHash: string };
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const key = (entry: { gameId: string | null; sourceId: string }) => JSON.stringify([entry.gameId, entry.sourceId]);

/** Bind only immutable source identity, so adding display JSON remains idempotent. */
export function abilityDisplayBindingHash(rows: AbilityDisplayRow[]) {
  return artifactHash([...rows].sort((a, b) => a.id - b.id).map(row => ({
    id: row.id, championId: row.championId, gameId: row.gameId, sourceId: row.sourceId,
    raw: isObject(row.template) ? row.template.raw : undefined,
  })));
}

export function parseAbilityDisplayBindings(text: string): AbilityDisplayChampionBinding[] {
  const input: unknown = JSON.parse(text);
  if (!isObject(input) || input.schemaVersion !== 1 || !Array.isArray(input.bindings)) throw new Error('Invalid display champion bindings.');
  const seen = new Set<number>();
  return input.bindings.map(binding => {
    if (!isObject(binding) || !Number.isSafeInteger(binding.championId) || Number(binding.championId) <= 0
      || typeof binding.gameId !== 'string' || !binding.gameId.trim()
      || typeof binding.sourceRowsHash !== 'string' || !/^[a-f0-9]{64}$/.test(binding.sourceRowsHash)) {
      throw new Error('Invalid display champion binding.');
    }
    const championId = Number(binding.championId);
    if (seen.has(championId)) throw new Error('Duplicate display champion binding.');
    seen.add(championId);
    return { championId, gameId: binding.gameId, sourceRowsHash: binding.sourceRowsHash };
  });
}

/** A repair-only alias; it never changes Champion.gameId or overrides an existing ID. */
export function applyAbilityDisplayBindings(rows: AbilityDisplayRow[], bindings: AbilityDisplayChampionBinding[]) {
  const byChampion = new Map<number, AbilityDisplayChampionBinding>();
  for (const binding of bindings) {
    if (byChampion.has(binding.championId)) throw new Error('Duplicate display champion binding.');
    const selected = rows.filter(row => row.championId === binding.championId);
    if (!selected.length) throw new Error('Display binding champion is not selected.');
    if (selected.some(row => row.gameId !== null)) throw new Error('Display binding cannot override an existing game ID.');
    if (abilityDisplayBindingHash(selected) !== binding.sourceRowsHash) throw new Error('Display binding source snapshot differs.');
    byChampion.set(binding.championId, binding);
  }
  return rows.map(row => byChampion.has(row.championId) ? { ...row, gameId: byChampion.get(row.championId)!.gameId } : row);
}

export function parseAbilityDisplayFile(text: string): AbilityDisplayFile {
  const input: unknown = JSON.parse(text);
  if (!isObject(input) || input.schemaVersion !== 1 || !Array.isArray(input.entries) || !isObject(input.provenance)) throw new Error('Invalid ability display file.');
  const provenance: Record<string, string> = {};
  for (const [name, hash] of Object.entries(input.provenance)) {
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid ability display provenance.');
    provenance[name] = hash;
  }
  const seen = new Set<string>();
  const entries = input.entries.map((entry): AbilityDisplayEntry => {
    if (!isObject(entry) || typeof entry.gameId !== 'string' || typeof entry.sourceId !== 'string' || typeof entry.raw !== 'string') throw new Error('Invalid ability display binding.');
    const display = readAbilityTextDisplay(entry.display);
    if (!display) throw new Error('Missing ability display metadata.');
    const parsed = { gameId: entry.gameId, sourceId: entry.sourceId, raw: entry.raw, display };
    if (seen.has(key(parsed))) throw new Error('Duplicate ability display binding.');
    seen.add(key(parsed));
    return parsed;
  });
  return { schemaVersion: 1, provenance, entries };
}

export function attachAbilityDisplay<T extends { raw: string }>(template: T, entry?: AbilityDisplayEntry): T & { display?: ChampionAbilityTextDisplay } {
  return entry?.raw === template.raw ? { ...template, display: entry.display } : template;
}

/** Match exact existing identities and raw text; only add display metadata. */
export function planAbilityDisplayUpdates(rows: AbilityDisplayRow[], entries: AbilityDisplayEntry[]) {
  const bySource = new Map(entries.map(entry => [key(entry), entry]));
  const updates: Array<{ id: number; championId: number; sourceId: string; before: Record<string, unknown>; after: Record<string, unknown> }> = [];
  const unmatched: number[] = [];
  const drifted: number[] = [];
  let unchanged = 0;
  for (const row of rows) {
    const entry = bySource.get(key(row));
    if (!entry) { unmatched.push(row.id); continue; }
    if (!isObject(row.template) || row.template.raw !== entry.raw) { drifted.push(row.id); continue; }
    const before = row.template;
    const existingDisplay = before.display === undefined ? undefined : readAbilityTextDisplay(before.display);
    if (JSON.stringify(existingDisplay) === JSON.stringify(entry.display)) { unchanged++; continue; }
    // Original blocks, raw text, IDs, titles, order, values and relations stay intact.
    updates.push({ id: row.id, championId: row.championId, sourceId: row.sourceId, before, after: { ...before, display: entry.display } });
  }
  return { updates, unmatched, drifted, unchanged };
}
