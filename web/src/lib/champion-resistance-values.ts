import type { ResistanceDetail } from '@cerebro/core/domain/champion-resistance';
import { prepareChampionAbilityTextView, type ChampionAbilityStat, type PreparedChampionAbilityTextNode, type PreparedChampionAbilityTextView } from './champion-ability-text';
import { buildSynergyCardContent, type ChampionSynergyCard } from './champion-synergies';

export type ResistanceValueContext = { sigLevel?: number; maxSig?: number; preview?: boolean; championName?: string; championAliases?: string[]; stat?: ChampionAbilityStat };
export type RecordedResistanceValue = { label: string; text: string };
const normalize = (text: string) => text.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();

/** Select complete recorded protection passages; never turn a cap or per-stack amount into a flat modifier. */
function isProtectionValue(text: string, effect: string, detail: ResistanceDetail): boolean {
  const word = (effect === 'Debuffs' ? 'Debuff' : effect).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The game elides shared words in lists such as "Power Drain, Steal, and Burn"
  // and "Power and Special Lock". Expand only for matching; display stays verbatim.
  const searchable = text.replace(/Power (Drain|Steal|Burn)((?:(?:,\s*|\s+and\s+|\s*&\s*)(?:and\s+)?(?:Drain|Steal|Burn|Lock))+)/gi,
    (_, first: string, rest: string) => `Power ${first}${rest.replace(/\b(Drain|Steal|Burn|Lock)\b/g, 'Power $1')}`)
    .replace(/\bPower and Special Lock\b/gi, 'Power Lock and Special Lock')
    .replace(/\beffects? that\s+((?:Steal|Burn|Drain)(?:(?:,\s*|\s+or\s+)(?:or\s+)?(?:Steal|Burn|Drain))*)\s+([^.;]{0,40})\bPower\b/gi,
      (match: string, verbs: string) => `${match} ${verbs.replace(/\b(Steal|Burn|Drain)\b/g, 'Power $1')}`);
  if (!new RegExp(`\\b${word}s?\\b`, 'i').test(searchable) || /[{}]|\b(?:unresolved|legacy|audit)\b/i.test(text)
    || !/\d[\d,.]*\s*(?:%|seconds?\b)/i.test(text)) return false;
  const metricReduced = (metric: string) => new RegExp(`(?:reduc\\w*|decreas\\w*|lower\\w*|shorten\\w*)[^.;]{0,80}\\b${metric}s?\\b|\\b${metric}s?\\b[^.;]{0,80}(?:reduc\\w*|decreas\\w*|lower\\w*|shorten\\w*)|-\\d[\\d,.]*\\s*%\\s*(?:\\w+\\s+){0,3}${metric}s?\\b`, 'i').test(text);
  const duration = metricReduced('duration') || /(?:expire|recover|shrug)[^.;]*faster/i.test(text);
  const potency = metricReduced('potency') || /resistan/i.test(text);
  const damage = /(?:reduc\w*|decreas\w*|less|resistan\w*)[^.;]{0,65}\bdamage\b|\bdamage\s+resistan|\bdamage\b\s+(?:(?:taken|received|is|are|from|of|incoming|\w+ effects?)\s+){0,6}(?:reduc\w*|decreas\w*)|(?:deal|takes?)\s*-\d/i.test(text);
  return detail.mechanism === 'RESISTANCE' ? /resistan/i.test(text)
    : detail.mechanism === 'DAMAGE' ? damage
      : detail.mechanism === 'DURATION' ? duration
        : detail.mechanism === 'POTENCY' ? potency : potency && duration;
}

function completeText(nodes: PreparedChampionAbilityTextNode[]): string | null {
  const parts = nodes.map(node => node.type === 'text' ? node.value : node.type === 'glossary' ? node.label
    : node.type === 'color' ? completeText(node.children) : node.resolution.status === 'resolved' ? node.resolution.displayValue : null);
  return parts.includes(null) ? null : parts.join('');
}
const distinct = (values: RecordedResistanceValue[]) => {
  const result = [...new Map(values.map(value => [`${value.label}\0${value.text}`, value])).values()];
  return result.length ? result : undefined;
};

export function nativeResistanceValues(effect: string, detail: ResistanceDetail | undefined, recordedSource: string,
  view: PreparedChampionAbilityTextView, context: ResistanceValueContext): RecordedResistanceValue[] | undefined {
  if (!detail || detail.percent !== null || !detail.valueRecords?.length) return undefined;
  const signatureOnly = /^(?:signature|dupe|awakened)\b/i.test(recordedSource.trim());
  const records = detail.valueRecords.filter(record => !/bio|synerg/i.test(record.group)
    && (record.group !== 'signature' || /signature|dupe|awaken/i.test(recordedSource)));
  const sigLevel = context.sigLevel ?? context.maxSig ?? 200;
  const prepared = prepareChampionAbilityTextView({ records, curves: view.selectedCurves, sigLevel, maxSig: context.maxSig ?? 200, stat: context.stat });
  return distinct([prepared.signaturePanel, ...prepared.descriptionPanels].flatMap(panel => panel.records.flatMap(record => {
    if (record.prepared.status !== 'ready') return [];
    const texts = record.prepared.blocks.map(block => completeText(block.children));
    const values = texts.filter((text): text is string => text !== null && isProtectionValue(text, effect, detail));
    if (!values.length) return [];
    if ((signatureOnly || panel.group === 'signature') && sigLevel === 0) return [{ label: 'Unawakened', text: 'Signature ability inactive at Sig 0.' }];
    const label = signatureOnly || panel.group === 'signature' ? `Sig ${sigLevel}${context.preview ? ' preview' : ''}` : 'Recorded values';
    return values.map(text => ({ label, text }));
  })));
}

export function synergyResistanceValues(effect: string, detail: ResistanceDetail | undefined, cards: ChampionSynergyCard[],
  context: ResistanceValueContext, recordedSource = ''): RecordedResistanceValue[] | undefined {
  if (!detail || detail.percent !== null || !context.championName) return undefined;
  const recipients = [context.championName, ...(context.championAliases ?? [])].map(normalize);
  return distinct(cards.flatMap(card => buildSynergyCardContent(card.description.replace(/(\[[0-9a-f]{6}(?:[0-9a-f]{2})?\][^\[\n:]+:\[-\])/gi, '\n$1'), card.unique).bonuses.flatMap(row => {
    const recipient = row.label.map(segment => segment.text).join('').trim().replace(/:\s*$/, '');
    const body = row.body.map(segment => segment.text).join('').trim();
    const label = normalize(recipient);
    // A named teammate's modifier cannot be borrowed, even when it affects the same effect.
    const namedRecipient = recipient.split(/,|\band\b|\bor\b/i).some(name => recipients.includes(normalize(name)));
    const groupBranches = recipient.split(/\bexcept\b/i)[0].split(/\band\b/i).map(branch => normalize(branch).split(' ').filter(word => !['all', 'champions', 'champion'].includes(word)).map(word => word.replace(/s$/, '')));
    const sourceWords = normalize(recordedSource).split(' ').map(word => word.replace(/s$/, ''));
    const otherMember = [...(card.champions ?? []), ...card.partners].some(champion => [champion.name, champion.shortName].some(name => name && normalize(name) === label && !recipients.includes(label)));
    const recordedGroup = !otherMember && /\b(?:all|champions|beings|avengers|mutants)\b/i.test(recipient)
      && groupBranches.some(words => words.length > 0 && words.every(word => sourceWords.includes(word)));
    if (recipient && !namedRecipient && !recordedGroup && !/^(?:all (?:champions|teammates|synergy champions)|synergy champions|teammates)$/.test(label)) return [];
    const inlineRecipient = !recipient ? body.match(/^([^:]+):/)?.[1] : undefined;
    if (inlineRecipient && !recipients.includes(normalize(inlineRecipient))) return [];
    if (!isProtectionValue(body, effect, detail)) return [];
    const rarity = card.rarities?.length ? ` · ${card.rarities.map(value => `${value}★`).join('/')}` : '';
    return [{ label: `Synergy values${rarity}`, text: recipient ? `${recipient}: ${body}` : body }];
  })));
}
