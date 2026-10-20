import type { ChampionAbilityTextDisplay } from './types';

/** Display metadata is independent of the original text and its value bindings. */
export function readAbilityTextDisplay(value: unknown): ChampionAbilityTextDisplay | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid ability text display metadata.');
  const record = value as Record<string, unknown>;
  if (record.kind !== 'ability' && record.kind !== 'glossary') throw new Error('Invalid ability text display kind.');
  const display: ChampionAbilityTextDisplay = { kind: record.kind };
  for (const key of ['panelId', 'componentId', 'hudId'] as const) {
    if (record[key] === undefined) continue;
    if (typeof record[key] !== 'string') throw new Error(`Invalid ability text display ${key}.`);
    display[key] = record[key];
  }
  if (record.section !== undefined) {
    if (!record.section || typeof record.section !== 'object' || Array.isArray(record.section)) throw new Error('Invalid ability text display section.');
    const section = record.section as Record<string, unknown>;
    if (typeof section.id !== 'string' || !section.id.trim() || typeof section.title !== 'string' || !section.title.trim()) throw new Error('Invalid ability text display section.');
    display.section = { id: section.id, title: section.title };
  }
  return display;
}
