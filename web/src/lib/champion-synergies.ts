import type { ChampionClass } from '@prisma/client';

export type SynergyChampion = { id: number; name: string; shortName?: string; class?: ChampionClass; slug: string | null; images: unknown };
export type SynergyPartner = SynergyChampion & { rarities: number[] };
export type ChampionSynergy = {
  id: string; name: string; description: string; enabled: boolean; unique: boolean;
  requiredHeroGroups: boolean;
  members: Array<{ role: 'OWNER' | 'REQUIRED'; rarity: number; champion: SynergyChampion }>;
};
export type ChampionSynergyCard = Pick<ChampionSynergy, 'id' | 'name' | 'description' | 'unique'> & {
  partners: SynergyPartner[];
  champions?: SynergyChampion[];
};

export function buildChampionSynergyView(rows: ChampionSynergy[], championId: number, rarity: number | null) {
  const owned: ChampionSynergyCard[] = [];
  const incoming: ChampionSynergyCard[] = [];
  for (const row of rows) {
    if (!row.enabled || row.requiredHeroGroups) continue;
    const matches = row.members.filter(m => m.champion.id === championId && (rarity == null || m.rarity === rarity));
    const isOwner = matches.some(m => m.role === 'OWNER');
    if (!isOwner && !matches.some(m => m.role === 'REQUIRED')) continue;
    const partnerRole = isOwner ? 'REQUIRED' : 'OWNER';
    const partners = new Map<number, SynergyPartner>();
    for (const member of row.members.filter(m => m.role === partnerRole)) {
      const partner = partners.get(member.champion.id) ?? { ...member.champion, rarities: [] };
      if (!partner.rarities.includes(member.rarity)) partner.rarities.push(member.rarity);
      partners.set(partner.id, partner);
    }
    // Raw NPC/template-only synergies are retained in storage, not advertised as
    // activatable player combinations when there is no obtainable partner.
    if (!partners.size) continue;
    (isOwner ? owned : incoming).push({
      id: row.id, name: parseSynergyDescription(row.name).map(s => s.text).join(''), description: row.description, unique: row.unique,
      champions: [...new Map(row.members.map(member => [member.champion.id, member.champion])).values()],
      partners: [...partners.values()].map(p => ({ ...p, rarities: p.rarities.sort((a, b) => a - b) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  for (const cards of [owned, incoming]) cards.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { owned, incoming };
}

export type SynergyTextSegment = { text: string; color?: string; bold: boolean; italic: boolean; glossaryId?: string };

type SynergyChampionTextSegment = SynergyTextSegment & { championClass?: ChampionClass };

/** Highlight exact member names/short names only; conflicting aliases stay unclassified. */
export function highlightSynergyChampionNames(segments: SynergyTextSegment[], champions: SynergyChampion[]): SynergyChampionTextSegment[] {
  const normalize = (text: string) => text.trim().toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ');
  const aliases = new Map<string, ChampionClass | null>();
  for (const champion of champions) {
    for (const name of [champion.name, champion.shortName]) {
      if (!name?.trim()) continue;
      const alias = normalize(name);
      const championClass = champion.class ?? null;
      aliases.set(alias, aliases.has(alias) && aliases.get(alias) !== championClass ? null : championClass);
    }
  }
  const names = [...aliases].filter(([, championClass]) => championClass).map(([name]) => name).sort((a, b) => b.length - a.length);
  if (!names.length) return segments;
  const pattern = new RegExp(names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['\u2018\u2019]").replace(/ /g, '\\s+')).join('|'), 'giu');
  return segments.flatMap(segment => {
    if (segment.glossaryId) return [segment];
    const result: SynergyChampionTextSegment[] = [];
    let cursor = 0;
    for (const match of segment.text.matchAll(pattern)) {
      const start = match.index!;
      const end = start + match[0].length;
      if (!/(?:^|,|\band|&)\s*$/i.test(segment.text.slice(0, start)) || !/^\s*(?:,|\band\b|&|:|$)/i.test(segment.text.slice(end))) continue;
      if (start > cursor) result.push({ ...segment, text: segment.text.slice(cursor, start) });
      result.push({ ...segment, text: match[0], championClass: aliases.get(normalize(match[0]))! });
      cursor = end;
    }
    if (cursor < segment.text.length) result.push({ ...segment, text: segment.text.slice(cursor) });
    return result;
  });
}

/** Only known game markup is interpreted; HTML remains escaped React text. */
export function parseSynergyDescription(text: string): SynergyTextSegment[] {
  const tokens = /\[([0-9a-f]{6}(?:[0-9a-f]{2})?)\]|\[-\]|\[(\/?[bi])\]|\[k=glossary[/\\]([^\]]+)\]|\[[/\\]k\]/gi;
  const segments: SynergyTextSegment[] = [];
  const colors: string[] = [];
  let bold = 0, italic = 0, glossaryId: string | undefined, cursor = 0;
  const append = (value: string) => {
    if (value) segments.push({ text: value, color: colors.at(-1), bold: bold > 0, italic: italic > 0, glossaryId });
  };
  for (const match of text.matchAll(tokens)) {
    append(text.slice(cursor, match.index));
    if (match[1]) colors.push(`#${match[1]}`);
    else if (match[0] === '[-]') colors.pop();
    else if (match[2]?.toLowerCase() === 'b') bold++;
    else if (match[2]?.toLowerCase() === '/b') bold = Math.max(0, bold - 1);
    else if (match[2]?.toLowerCase() === 'i') italic++;
    else if (match[2]?.toLowerCase() === '/i') italic = Math.max(0, italic - 1);
    else if (match[3]) glossaryId = match[3];
    else glossaryId = undefined;
    cursor = match.index! + match[0].length;
  }
  append(text.slice(cursor));
  return segments;
}

/** Arrange existing source text for display without inferring recipients or rewriting effects. */
export function buildSynergyCardContent(description: string, unique: boolean) {
  const lines: SynergyTextSegment[][] = [[]];
  for (const segment of parseSynergyDescription(description)) {
    segment.text.split(/\r?\n/).forEach((text, index) => {
      if (index > 0) lines.push([]);
      if (text) lines.at(-1)!.push({ ...segment, text });
    });
  }
  const rows = lines.filter(line => line.some(segment => segment.text.trim()));
  const lastRow = rows.at(-1);
  const hasStandardUniqueNote = unique && lastRow && /^\s*(?:Unique(?: Synergy)?|Solo(?: Synergy)?):\s*(?:Does not stack with duplicate synergies|Only affects this champion and does not stack|Affects only this champion,? and does not stack)\.\s*$/i.test(lastRow.map(s => s.text).join(''));
  const uniqueNote = hasStandardUniqueNote ? rows.pop()! : null;
  return {
    bonuses: rows.map(segments => {
      const first = segments.findIndex(segment => segment.text.trim());
      const label = segments[first];
      // Only an explicitly formatted source label becomes a heading. Colons in
      // ordinary sentences or unfamiliar markup retain their original context.
      const hasLabel = label && (label.color || label.bold) && /^[^:]+:\s*$/.test(label.text);
      return hasLabel
        ? { label: segments.slice(0, first + 1), body: segments.slice(first + 1) }
        : { label: [], body: segments };
    }),
    uniqueNote,
  };
}

export function collectSynergyGlossaryIds(rows: Pick<ChampionSynergy, 'description'>[]) {
  return [...new Set(rows.flatMap(row => parseSynergyDescription(row.description).flatMap(s => s.glossaryId ? [s.glossaryId] : [])))].sort();
}
