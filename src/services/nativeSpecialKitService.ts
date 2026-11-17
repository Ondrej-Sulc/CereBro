import type { Prisma } from '@prisma/client';
import { buildGameDescriptionTextRecords, type GameDescriptionsFile } from './mcocGameDescriptionsImportService';
import { attachAbilityBindings, type AbilityBindingEntry } from './championAbilityBindingService';
import { attachAbilityDisplay, type AbilityDisplayEntry } from './championAbilityDisplayService';
import { readGameDisplayBinding } from '../domain/champion-ability-text/game-binding';
import type { ChampionAbilityTextTemplateNode } from '../domain/champion-ability-text/types';

type SourceIdentity = { gameId: string; sourceId: string };
export type NativeSpecialAbilityText = { sourceId: string; group: string; title: string | null; sortOrder: number; template: Prisma.InputJsonObject };
const key = (entry: SourceIdentity) => JSON.stringify([entry.gameId, entry.sourceId]);

function indexEntries<T extends SourceIdentity>(entries: readonly T[]) {
  const index = new Map<string, T>();
  for (const entry of entries) {
    if (index.has(key(entry))) throw new Error('Duplicate source metadata identity');
    index.set(key(entry), entry);
  }
  return index;
}

function assertPlainJson(value: unknown): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { value.forEach(assertPlainJson); return; }
  if (typeof value !== 'object' || value === null || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error('Template must contain only finite plain JSON values');
  }
  Object.values(value).forEach(assertPlainJson);
}

/** Source-only projection. The applying transaction must independently prove every target is newly created. */
export function projectNativeSpecialKits(descriptions: GameDescriptionsFile, options: {
  newGameIds: readonly string[];
  existingGameIds: readonly string[];
  abilityBindings: readonly AbilityBindingEntry[];
  displayMetadata: readonly AbilityDisplayEntry[];
}) {
  if (new Set(options.newGameIds).size !== options.newGameIds.length) throw new Error('Duplicate new champion identity');
  const existing = new Set(options.existingGameIds);
  if (options.newGameIds.some(gameId => existing.has(gameId))) throw new Error('Existing champion cannot receive a new-only kit');
  const bindings = indexEntries(options.abilityBindings);
  const displays = indexEntries(options.displayMetadata);
  const held: Array<SourceIdentity & { reason: string }> = [];
  const missingDescriptions: string[] = [];
  const omittedGenericSpecials: SourceIdentity[] = [];
  const statsDependentRows: SourceIdentity[] = [];
  const champions = options.newGameIds.map(gameId => {
    const abilityTexts: NativeSpecialAbilityText[] = [];
    const description = descriptions[gameId];
    if (!description) { missingDescriptions.push(gameId); return { gameId, abilityTexts }; }
    if (description.base_id !== gameId) throw new Error(`Source game ID differs: ${gameId}`);
    for (const record of buildGameDescriptionTextRecords(description)) {
      const identity = { gameId, sourceId: record.sourceId };
      if (record.group === 'special' && /^[A-Z0-9_]+ unleashes a signature attack on their opponent\.$/.test(record.template.raw)) {
        omittedGenericSpecials.push(identity); continue;
      }
      const display = displays.get(key(identity));
      if (!['bio', 'special'].includes(record.group) && (!display || display.raw !== record.template.raw)) {
        throw new Error(`Missing exact display metadata: ${gameId}/${record.sourceId}`);
      }
      const binding = bindings.get(key(identity));
      if (/\{\d+\}/.test(record.template.raw) && !binding) {
        held.push({ ...identity, reason: 'missing-verified-numeric-binding' }); continue;
      }
      if (binding && (display?.display.componentId !== binding.componentId || display?.display.hudId !== binding.hudId)) {
        throw new Error(`Binding display identity differs: ${gameId}/${record.sourceId}`);
      }
      const template = attachAbilityBindings(attachAbilityDisplay(record.template, display), binding);
      let requiresStats = false;
      const visit = (nodes: ChampionAbilityTextTemplateNode[]) => { for (const node of nodes) {
        if (node.type === 'color') visit(node.children);
        if (node.type !== 'value') continue;
        const source = node.source;
        const verified = source?.kind === 'abilityParam' ? readGameDisplayBinding(source.gameBinding) : null;
        if (!verified || verified.slot !== node.placeholderIndex || source?.kind !== 'abilityParam' || source.rawValue !== verified.value) {
          throw new Error(`Numeric binding differs: ${gameId}/${record.sourceId}`);
        }
        if (verified.formula && ['mod_x_attk', 'mod_x_hp', 'standard', 'standard_critdam'].includes(verified.formula.type)) requiresStats = true;
      } };
      template.blocks?.forEach(block => visit(block.children));
      assertPlainJson(template);
      abilityTexts.push({ ...record, template: JSON.parse(JSON.stringify(template)) as Prisma.InputJsonObject });
      if (requiresStats) statsDependentRows.push(identity);
    }
    return { gameId, abilityTexts };
  });
  return { champions, held, missingDescriptions, omittedGenericSpecials, statsDependentRows };
}
