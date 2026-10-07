import { describe, expect, it } from 'vitest';
import { buildChampionSynergyView, parseSynergyDescription, type ChampionSynergy } from './champion-synergies';

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
