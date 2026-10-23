import { readGameDisplayBinding, resolveGameDisplayBinding } from './champion-ability-text/game-binding';
import type { ResistanceMechanism } from './champion-resistance';
import { createHash } from 'node:crypto';

/** New evidence receipts use binary key ordering, independent of the host locale. */
export function resistanceEvidenceHash(value: unknown): string {
  const canonical = (item: unknown): string => {
    if (item === null || typeof item !== 'object') return JSON.stringify(item);
    if (item instanceof Date) return JSON.stringify(item.toISOString());
    if (Array.isArray(item)) return `[${item.map(canonical).join(',')}]`;
    const object = item as Record<string, unknown>;
    return `{${Object.keys(object).filter(key => object[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  };
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function resistanceEvidenceRecords(evidence: unknown): Array<{ recordId: number; templateHash: string }> | null {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return null;
  const value = evidence as Record<string, unknown>;
  if (value.version !== 1 || !Array.isArray(value.records)) return null;
  const records: Array<{ recordId: number; templateHash: string }> = [];
  for (const record of value.records) {
    if (!record || typeof record !== 'object' || !Number.isSafeInteger(record.recordId)
      || typeof record.templateHash !== 'string' || !/^[a-f0-9]{64}$/.test(record.templateHash)) return null;
    records.push({ recordId: record.recordId, templateHash: record.templateHash });
  }
  return records;
}

const targets = ['Power Drain', 'Power Burn', 'Power Steal', 'Power Lock', 'Special Lock', 'Power Sting',
  'Armor Break', 'Heal Block', 'Fate Seal', 'Degeneration', 'Incinerate', 'Coldsnap', 'Bleed', 'Poison', 'Shock',
  'Rupture', 'Stun', 'Slow', 'Nullify', 'Debuffs'];
export type ResistanceSource = { type: string; name: string; source: string | null; effectDirection: string };
export type ResistanceProposal = { target: string; mechanism: ResistanceMechanism };

/** Only explicit incoming protection is classified. General mitigation and outgoing reductions stay abilities. */
export function classifyResistanceSource(link: ResistanceSource): ResistanceProposal[] {
  if (link.type !== 'ABILITY' || link.effectDirection !== 'GAIN' || !link.source?.trim()) return [];
  const source = link.source.replace(/^Synergy: .+?\([1-7]★(?:\/[1-7]★)*\) with .+?(?:; does not stack)?:\s*/i, '');
  if (/does not confirm|recipient.*(?:unknown|unresolved)|whose.*(?:unknown|unresolved)/i.test(source)) return [];
  const clause = source.split(/;(?![^{}]*\})|\.(?:\s|$)/).find(part => /resistan|reduc|less|expire|recover|shrug|decreased|potency|duration/i.test(part))?.replace(/\([^)]*\)/g, '') ?? source;
  const named = link.name.match(/^(.+?) (?:Resistance|Resist|Duration Reduction|Potency Reduction)$/);
  const specific = named?.[1] === 'Debuff' ? targets.filter(target => target !== 'Debuffs' && new RegExp(`\\b${target}\\b`, 'i').test(clause)) : [];
  const candidates = specific.length ? specific : named ? targets.filter(target => target === named[1] || (target === 'Debuffs' && named[1] === 'Debuff'))
    : /^(?:Damage Reduction|Reduce Damage)$/.test(link.name) ? targets.filter(target => {
      if (target === 'Debuffs') return false;
      const word = `${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?`;
      const incoming = source.match(/\bincoming\s+([^.;]+?)(?:potency|duration|damage|suffer|have|are)/i)?.[1] ?? '';
      return new RegExp(`\\b${word}\\b`, 'i').test(incoming)
        || new RegExp(`(?:${word} only:|(?:less|reduced|reduce|reduced by)[^.;]{0,24}\\b${word} (?:damage|potency)|(?:less|reduce) damage from [^.;]{0,30}\\b${word}\\b|(?:lower|reduc)\\w* potency of (?:future|incoming) ${word}\\b|resistan(?:ce|t) to ${word}\\b|${word} (?:effects? |debuffs? )?(?:potency|damage|resistance)|${word} damage resistance)`, 'i').test(source);
    }) : [];
  return candidates.map(target => {
    // Later sentences may describe unrelated lifetimes; the protection's clause establishes its mechanism.
    const potency = /potency/i.test(clause) || /Potency Reduction$/.test(link.name);
    const duration = (/duration|recover.*faster|expire.*faster|shrug.*faster/i.test(clause)
      && !/\+[\d.]+%\s*duration|(?:increas|longer)[^.;]{0,16}duration|duration[^.;]{0,16}(?:increas|longer)/i.test(clause)) || /Duration Reduction$/.test(link.name);
    const mechanism: ResistanceMechanism = potency && duration ? 'POTENCY_AND_DURATION' : potency ? 'POTENCY'
      : duration ? 'DURATION' : /(?:less|reduc\w*|resistan\w*).{0,25}damage|damage.{0,25}(?:reduc\w*|resistan\w*)/i.test(clause) ? 'DAMAGE' : 'RESISTANCE';
    return { target, mechanism };
  });
}

/** Match inflected game labels (Bleeds, Stuns, Debuffs) without matching names such as Bleeding. */
export function mentionsResistanceEffect(text: string, effect: string): boolean {
  const word = effect === 'Debuffs' ? 'Debuff' : effect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${word}s?\\b`, 'i').test(text);
}

const variableProtection = /signature|legacy|unresolved|up to|based on|scal|additional|increas|reduced to|\d\s*[-–]\s*\d/i;
const percentages = (text: string) => [...text.matchAll(/(?:^|[^\d.])([+-]?\d+(?:\.\d+)?)\s*%/g)].map(match => Math.abs(Number(match[1])));
const percentDisplay = new Intl.NumberFormat('en-US', { useGrouping: false, maximumFractionDigits: 2 });

/** Plain imported text plus only build-independent game percentage arguments, at game display precision. */
function fixedTemplateText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  if (Array.isArray(node)) return node.map(fixedTemplateText).join('');
  const value = node as Record<string, unknown>;
  if (value.type === 'text') return typeof value.value === 'string' ? value.value : '';
  if (value.type === 'glossary') return typeof value.label === 'string' ? value.label : '';
  if (value.type === 'value') {
    const source = value.source as Record<string, unknown> | undefined;
    try {
      const binding = readGameDisplayBinding(source?.gameBinding);
      if (!binding.growth && (binding.slot === 0 || (binding.slot === 1 && ['identity', 'mod_x_vara'].includes(binding.formula!.type)))) {
        const resolved = resolveGameDisplayBinding(binding, 0);
        // The full-ability renderer displays these fields with at most two decimals.
        if (resolved !== null) return percentDisplay.format(resolved);
      }
    } catch { /* Unverified, signature- or build-dependent values remain unresolved. */ }
    return '{unresolved}';
  }
  if (Array.isArray(value.blocks)) return value.blocks.map(fixedTemplateText).join('\n');
  return fixedTemplateText(value.children);
}

/** Numeric labels require the target's protection clause in an imported record, not a coincidental number. */
export function fixedResistancePercent(source: string, templates: unknown[], effect: string): number | null {
  // Native combat bindings cannot prove a separate synergy modifier.
  if (/^Synergy:/i.test(source)) return null;
  if (variableProtection.test(source)) return null;
  const sourceClauses = source.split(/[.;](?:\s|$)/);
  if (sourceClauses.some(clause => /\bper\b|\beach\b/i.test(clause) && /%/.test(clause))) return null;
  const amounts = [...new Set(percentages(source))];
  if (amounts.length !== 1) return null;
  return templates.some(template => fixedTemplateText(template)
    .split(/[.;](?:\s|$)|\n|\band\s+(?=(?:the|he|she|his|her|their|makes)\b|[+-]?\d+(?:\.\d+)?\s*%)/i)
    .some(clause => mentionsResistanceEffect(clause, effect) && !variableProtection.test(clause)
      && !/\bper\b|\beach\b/i.test(clause)
      && /resistan|reduc|decreas|less damage|(?:suffer|deal|takes?)\s*-\d/i.test(clause)
      && percentages(clause).includes(amounts[0]))) ? amounts[0] : null;
}
