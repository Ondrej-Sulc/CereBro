export type SynergyChampion = { id: number; name: string; slug: string | null; images: unknown };
export type SynergyPartner = SynergyChampion & { rarities: number[] };
export type ChampionSynergy = {
  id: string; name: string; description: string; enabled: boolean; unique: boolean;
  requiredHeroGroups: boolean;
  members: Array<{ role: 'OWNER' | 'REQUIRED'; rarity: number; champion: SynergyChampion }>;
};
export type ChampionSynergyCard = Pick<ChampionSynergy, 'id' | 'name' | 'description' | 'unique'> & {
  partners: SynergyPartner[];
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
      partners: [...partners.values()].map(p => ({ ...p, rarities: p.rarities.sort((a, b) => a - b) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  for (const cards of [owned, incoming]) cards.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { owned, incoming };
}

export type SynergyTextSegment = { text: string; color?: string; bold: boolean; italic: boolean; glossaryId?: string };

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

export function collectSynergyGlossaryIds(rows: Pick<ChampionSynergy, 'description'>[]) {
  return [...new Set(rows.flatMap(row => parseSynergyDescription(row.description).flatMap(s => s.glossaryId ? [s.glossaryId] : [])))].sort();
}
