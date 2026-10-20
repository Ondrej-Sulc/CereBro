import { describe, expect, it } from 'vitest';
import { buildChampionSynergyView, buildSynergyCardContent, highlightSynergyChampionNames, parseSynergyDescription, type ChampionSynergy, type SynergyChampion } from './champion-synergies';

const colossus = { id: 1, name: 'Colossus (AoA)', slug: 'colossus-age-of-apocalypse', images: {} };
const magik = { id: 2, name: 'Magik', slug: 'magik', images: {} };
const row: ChampionSynergy = {
  id: 'mountain', name: 'Big Shiny Mountain', description: 'Regenerate 40%.', enabled: true,
  unique: true, requiredHeroGroups: false,
  members: [
    { role: 'OWNER', rarity: 6, champion: colossus },
    { role: 'OWNER', rarity: 7, champion: colossus },
    { role: 'REQUIRED', rarity: 5, champion: magik },
    { role: 'REQUIRED', rarity: 6, champion: magik },
  ],
};

describe('champion synergy view', () => {
  it('carries actual classes and both owner/partner identities into each card once', () => {
    const typedRow: ChampionSynergy = { ...row, members: row.members.map(member => ({ ...member, champion: { ...member.champion, class: member.champion.id === 1 ? 'MUTANT' : 'MYSTIC' } })) };
    const owned = buildChampionSynergyView([typedRow], 1, 7).owned[0];
    expect(owned.partners[0].class).toBe('MYSTIC');
    expect(owned.champions?.map(champion => [champion.id, champion.class])).toEqual([[1, 'MUTANT'], [2, 'MYSTIC']]);
    expect(buildChampionSynergyView([typedRow], 2, 5).incoming[0].partners[0].class).toBe('MUTANT');
  });

  it('shows only the selected rarity and combines partner rarities into one portrait', () => {
    expect(buildChampionSynergyView([row], 1, 5).owned).toEqual([]);
    const view = buildChampionSynergyView([row], 1, 7);
    expect(view.owned).toHaveLength(1);
    expect(view.owned[0].partners).toEqual([{ ...magik, rarities: [5, 6] }]);
    expect(view.incoming).toEqual([]);
    const incoming = buildChampionSynergyView([row], 2, 5);
    expect(incoming.incoming[0].partners).toEqual([{ ...colossus, rarities: [6, 7] }]);
    expect(buildChampionSynergyView([row], 2, 7).incoming).toEqual([]);
  });

  it('does not show disabled, unsupported, or unavailable teammate combinations', () => {
    expect(buildChampionSynergyView([{ ...row, enabled: false }], 1, 7).owned).toEqual([]);
    expect(buildChampionSynergyView([{ ...row, requiredHeroGroups: true }], 1, 7).owned).toEqual([]);
    expect(buildChampionSynergyView([{ ...row, members: row.members.filter(m => m.role === 'OWNER') }], 1, 7).owned).toEqual([]);
    const both = { ...row, members: [...row.members, { role: 'REQUIRED' as const, rarity: 7, champion: colossus }] };
    expect(buildChampionSynergyView([both], 1, 7).incoming).toEqual([]);
  });

  it('preserves line breaks, colors, emphasis and glossary references without interpreting HTML', () => {
    const segments = parseSynergyDescription('[64acff][b]Magik:[/b][-]\nGain [k=glossary/fury][i]Fury[/i][/k]. <script>alert(1)</script>');
    expect(segments[0]).toMatchObject({ text: 'Magik:', color: '#64acff', bold: true });
    expect(segments.find(s => s.text === 'Fury')).toMatchObject({ glossaryId: 'fury', italic: true });
    expect(segments.map(s => s.text).join('')).toBe('Magik:\nGain Fury. <script>alert(1)</script>');
    expect(segments.at(-1)?.glossaryId).toBeUndefined();
  });

  it('handles game names with formatting and backslash glossary tags while keeping literal brackets', () => {
    const view = buildChampionSynergyView([{ ...row, name: '[ffcc00]Big Shiny Mountain[-]' }], 1, 7);
    expect(view.owned[0].name).toBe('Big Shiny Mountain');
    const segments = parseSynergyDescription(String.raw`[k=glossary\phys_res]Physical Resistance[\k] [Max 1 Stack]`);
    expect(segments[0]).toMatchObject({ text: 'Physical Resistance', glossaryId: 'phys_res' });
    expect(segments.at(-1)).toMatchObject({ text: ' [Max 1 Stack]', glossaryId: undefined });
  });
});

describe('synergy champion class highlighting', () => {
  const member = (id: number, name: string, championClass: SynergyChampion['class'], shortName?: string): SynergyChampion => ({ id, name, class: championClass, shortName, slug: null, images: {} });
  const members = [member(1, "Jack O'Lantern", 'TECH'), member(2, 'Red Goblin', 'COSMIC'), member(3, 'Green Goblin', 'TECH')];
  const highlight = (text: string, champions = members) => highlightSynergyChampionNames(parseSynergyDescription(`[64acff]${text}[-]`), champions);

  it('colors individual members of mixed-class lists while preserving separators and source formatting', () => {
    const label = "Jack O'Lantern, Red Goblin and Green Goblin:";
    const segments = highlight(label);
    expect(segments.map(s => s.text).join('')).toBe(label);
    expect(segments.filter(s => s.championClass).map(s => [s.text, s.championClass])).toEqual([
      ["Jack O'Lantern", 'TECH'], ['Red Goblin', 'COSMIC'], ['Green Goblin', 'TECH'],
    ]);
    expect(segments.every(s => s.color === '#64acff')).toBe(true);
    expect(highlight('Synergy Champions:').every(s => !s.championClass)).toBe(true);
  });

  it('uses exact known names and short names, including source apostrophes, casing and whitespace', () => {
    expect(highlight('Jack O’Lantern:').find(s => s.championClass)?.championClass).toBe('TECH');
    expect(highlight('RED  GOBLIN:').find(s => s.championClass)?.championClass).toBe('COSMIC');
    const champions = [member(4, 'Colossus (Age of Apocalypse)', 'MUTANT', 'Colossus (AoA)')];
    expect(highlight('Colossus (AoA):', champions).find(s => s.championClass)?.text).toBe('Colossus (AoA)');
  });

  it('keeps unknown variants, partial names, missing classes and ambiguous aliases neutral', () => {
    expect(highlight('Red Goblin (Unknown):').every(s => !s.championClass)).toBe(true);
    expect(highlight('All Red Goblin Champions:').every(s => !s.championClass)).toBe(true);
    const champions = [member(4, 'Spider-Man (Classic)', 'SCIENCE', 'Spider-Man'), member(5, 'Spider-Man (Stark Enhanced)', 'TECH', 'Spider-Man'), member(6, 'Unclassified', undefined)];
    expect(highlight('Spider-Man:', champions).every(s => !s.championClass)).toBe(true);
    expect(highlight('Unclassified:', champions).every(s => !s.championClass)).toBe(true);
    expect(highlight('Spider-Man (Classic):', champions).find(s => s.championClass)?.championClass).toBe('SCIENCE');
  });

  it('preserves glossary semantics instead of reclassifying terms as champion names', () => {
    const segments = parseSynergyDescription('[k=glossary/red_goblin]Red Goblin[/k]');
    expect(highlightSynergyChampionNames(segments, members)).toEqual(segments);
  });
});

describe('synergy card content', () => {
  const text = (segments: ReturnType<typeof parseSynergyDescription>) => segments.map(segment => segment.text).join('');

  it('separates source-labelled bonuses while preserving every word and inline glossary format', () => {
    const description = '[64acff]Jack O\'Lantern:[-] Inflict [k=glossary/poison][b]Poison[/b][/k].\n[64acff]Red Goblin:[-] Gain an extra bomb.\n[f79f0e]Unique Synergy:[-] Does not stack with duplicate synergies.';
    const content = buildSynergyCardContent(description, true);
    expect(content.bonuses).toHaveLength(2);
    expect(text(content.bonuses[0].label)).toBe("Jack O'Lantern:");
    expect(content.bonuses[0].body.find(segment => segment.text === 'Poison')).toMatchObject({ glossaryId: 'poison', bold: true });
    expect(content.bonuses.map(row => text([...row.label, ...row.body])).concat(text(content.uniqueNote!)).join('\n'))
      .toBe(text(parseSynergyDescription(description)));
  });

  it('retains active markup across line breaks and accepts Windows line endings', () => {
    const content = buildSynergyCardContent('[64acff][b]First:\r\nSecond:[/b][-] Second bonus.', false);
    expect(content.bonuses.map(row => row.label[0])).toEqual([
      { text: 'First:', color: '#64acff', bold: true, italic: false, glossaryId: undefined },
      { text: 'Second:', color: '#64acff', bold: true, italic: false, glossaryId: undefined },
    ]);
    expect(text(content.bonuses[1].body)).toBe(' Second bonus.');
  });

  it('keeps unformatted or mid-sentence colons in context instead of inventing recipients', () => {
    const description = 'On activation: gain Fury.\n[64acff]Gain Fury: lasts 10 seconds.[-]';
    const content = buildSynergyCardContent(description, false);
    expect(content.bonuses.every(row => row.label.length === 0)).toBe(true);
    expect(content.bonuses.map(row => text(row.body))).toEqual(['On activation: gain Fury.', 'Gain Fury: lasts 10 seconds.']);
  });

  it('moves only the exact trailing standard Unique rule and only for unique cards', () => {
    const note = 'Unique Synergy: Does not stack with duplicate synergies.';
    expect(buildSynergyCardContent(`Gain Fury.\n${note}`, true).uniqueNote?.map(s => s.text).join('')).toBe(note);
    for (const [description, unique] of [
      [`Gain Fury.\n${note}`, false],
      [`Gain Fury.\n${note} Also grants Armor.`, true],
      [`${note}\nGain Fury.`, true],
    ] as const) {
      const content = buildSynergyCardContent(description, unique);
      expect(content.uniqueNote).toBeNull();
      expect(content.bonuses.map(row => text([...row.label, ...row.body])).join('\n')).toBe(description);
    }
  });

  it('preserves Solo wording and ownership when moving its standard stacking rule into the footer', () => {
    for (const note of [
      'Solo: Only affects this Champion and does not stack.',
      'Solo Synergy: Only affects this Champion and does not stack.',
      'Solo: Affects only this champion, and does not stack.',
    ]) {
      const content = buildSynergyCardContent(`[64acff]Doctor Doom:[-] Gain Armor.\n[ffcc00]${note}[-]`, true);
      expect(content.bonuses).toHaveLength(1);
      expect(text(content.uniqueNote!)).toBe(note);
      expect(text([...content.bonuses[0].label, ...content.bonuses[0].body])).toBe('Doctor Doom: Gain Armor.');
    }
  });

  it('keeps plain team bonuses and literal HTML as escaped text, with no empty bonus rows', () => {
    const content = buildSynergyCardContent('\nAll Champions gain +6% Attack Rating.\n\n<script>example</script>\n', false);
    expect(content.bonuses).toHaveLength(2);
    expect(content.bonuses.map(row => text(row.body))).toEqual(['All Champions gain +6% Attack Rating.', '<script>example</script>']);
    expect(buildSynergyCardContent('', true)).toEqual({ bonuses: [], uniqueNote: null });
  });
});
