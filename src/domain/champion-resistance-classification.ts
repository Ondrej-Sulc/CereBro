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

/** Numeric labels require a matching, stat-independent modifier from an imported combat record. */
export function fixedResistancePercent(source: string, templates: unknown[]): number | null {
  // Native combat bindings cannot prove a separate synergy modifier.
  if (/^Synergy:/i.test(source)) return null;
  const body = source.replace(/^Synergy: .+?\([1-7]★(?:\/[1-7]★)*\) with .+?(?:; does not stack)?:\s*/i, '');
  if (/signature|legacy|unresolved|\bper\b|\beach\b|up to|based on|scal|additional|increas|reduced to|\d\s*[-–]\s*\d/i.test(body)) return null;
  const amounts = [...new Set([...body.matchAll(/(?:^|[^\d.-])(\d+(?:\.\d+)?)\s*%/g)].map(m => Number(m[1])))];
  if (amounts.length !== 1) return null;
  let found = false;
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const value = node as Record<string, unknown>;
    if (value.type === 'value' && value.source && typeof value.source === 'object') {
      const raw = value.source as Record<string, unknown>;
      if (raw.gameBinding) {
        try {
          const binding = readGameDisplayBinding(raw.gameBinding);
          if (binding.slot === 1 && !binding.growth && ['identity', 'mod_x_vara'].includes(binding.formula!.type)
            && resolveGameDisplayBinding(binding, 0) === amounts[0]) found = true;
        } catch { /* An unverified binding cannot establish a percentage. */ }
      }
    }
    if (value.children) visit(value.children);
    if (value.blocks) visit(value.blocks);
  };
  templates.forEach(visit);
  return found ? amounts[0] : null;
}
