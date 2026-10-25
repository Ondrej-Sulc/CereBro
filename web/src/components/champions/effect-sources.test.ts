import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EffectSources } from './effect-sources';
import type { ChampionKitEffect, ChampionKitSourceGroup } from '@/lib/champion-kit';
import { buildRosterKitDetails } from '@/lib/roster-kit-details';

const bleed: ChampionKitEffect = { name: 'Bleed', type: 'ABILITY', iconUrl: null, color: '#fff', secondaryColor: '#000', description: null, sources: [] };
const summary = "This synergy boosts Bleed potency; SP2's final hit inflicts timed Direct Damage Bleed, paused against Indestructible. It prevents healing and transfers denied healing to White Tiger subject to a Max-Health-based rate cap; expiry Nullifies all opponent Regeneration Buffs.";
const scream = { name: 'Scream', slug: 'scream', images: null };

function whiteTigerSources() {
  const levels = [
    { level: 1, potency: 9, stars: [3], id: 'scream_04' },
    { level: 2, potency: 12, stars: [4], id: 'scream_05' },
    { level: 3, potency: 15, stars: [5, 6, 7], id: 'scream_06' },
  ];
  return buildRosterKitDetails(levels.map(level => ({
    id: level.level, type: 'ABILITY' as const, effectForm: 'DEBUFF' as const, effectDirection: 'INFLICT' as const,
    source: `Synergy: BLOODY MARYS - LV. ${level.level} (2★/3★/4★/5★/6★/7★) with Scream (${level.stars.map(star => `${star}★`).join('/')}): Bleed potency +${level.potency}%. SP2 inflicts timed Bleed.`,
    overviewSummary: summary, ability: { name: 'Bleed', iconUrl: null, gameGlossaryTermId: null, description: null, gameGlossaryTerm: null, categories: [] }, synergyChampions: [{ champion: scream }],
  })), [], 7, levels.map(level => ({
    id: level.id, name: `BLOODY MARYS - LV. ${level.level}`, unique: false,
    description: `Bleed potency +${level.potency}%.`, partners: [{ ...scream, id: 1, rarities: level.stars }],
  }))).groups['INFLICT:Bleed'];
}

function galanSources() {
  const condition = 'This non-stacking synergy grants a Heavy Attack Stun Charge at sufficient Mass outside Harvest; starting a Heavy charge with the opponent in striking distance consumes it to inflict a temporary Stun Passive.';
  const mechanic = 'Reaching 315 Planetary Mass while Harvest is not active grants a Heavy Attack Stun Charge. Starting a Heavy Charge within striking distance consumes it to inflict a Stun Passive for 0.6 seconds.';
  const gentle = { name: 'Gentle', slug: 'gentle', images: null };
  const levels = [{ star: 5, id: 'gentle_02a', block: 53 }, { star: 6, id: 'gentle_02b', block: 57 }, { star: 7, id: 'gentle_02c', block: 70 }];
  const details = buildRosterKitDetails(levels.map(level => ({
    id: level.star, type: 'ABILITY' as const, effectForm: 'UNKNOWN' as const, effectDirection: 'GAIN' as const,
    source: `Synergy: MASSIVE GAINS (2★/3★/4★/5★/6★/7★) with Gentle (${level.star}★); does not stack: ${mechanic}`,
    overviewSummary: condition, ability: { name: 'Heavy Attack Stun Charge', iconUrl: null, gameGlossaryTermId: null, description: null, gameGlossaryTerm: null, categories: [] }, synergyChampions: [{ champion: gentle }],
  })), [], 2, levels.map(level => ({
    id: level.id, name: 'MASSIVE GAINS', unique: true, description: `[64acff]Gentle:[-] Gain +${level.block} Block Rating per Muscle Mass.\n[64acff]Galan:[-] ${mechanic}`,
    partners: [{ ...gentle, id: 1, rarities: [level.star] }],
  })));
  return { condition, groups: details.groups['GAIN:Heavy Attack Stun Charge'] };
}

describe('inline effect source references', () => {
  it.each([
    ['Haymakers', 'Dashing activates temporary Haymakers, subject to a cooldown.', 'Haymakers'],
    ['Special 2', 'SP2 immediately inflicts Bleed.', 'SP2'],
    ['Special 2', "SP2's final hit inflicts Bleed.", "SP2&#x27;s"],
    ['Charging Heavy', 'Charging a Heavy activates Haymakers.', 'Charging a Heavy'],
    ['Signature ability', 'His signature increases Bleed potency.', 'signature'],
  ])('links the existing %s source phrase without changing the condition', (label, condition, phrase) => {
    const groups: ChampionKitSourceGroup[] = [{ key: 'PASSIVE:GAIN', effectForm: 'PASSIVE', effectDirection: 'GAIN', synergies: [],
      nativeSources: [{ key: 'source', label, condition, target: { recordId: '42', chapter: 'base', title: label } }] }];
    const html = renderToStaticMarkup(createElement(EffectSources, { effect: bleed, groups, abilityHref: target => `/abilities#${target.recordId}` }));
    const paragraph = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/)?.[0] ?? '';
    expect(paragraph).toContain('href="/abilities#42"');
    expect(paragraph).toContain(`>${phrase}</span>`);
    expect(paragraph.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'")).toContain(condition);
    expect(paragraph).toContain('Passive');
  });

  it('uses an inline source prefix when the label is absent from the condition', () => {
    const groups: ChampionKitSourceGroup[] = [{ key: 'BUFF:GAIN', effectForm: 'BUFF', effectDirection: 'GAIN', synergies: [],
      nativeSources: [{ key: 'source', label: 'Signature ability', condition: 'Gain Fury below 50% Health.', target: { recordId: '42', chapter: 'signature', title: 'Awakened' } }] }];
    const html = renderToStaticMarkup(createElement(EffectSources, { effect: bleed, groups, abilityHref: target => `/abilities#${target.recordId}` }));
    const paragraph = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/)?.[0] ?? '';
    expect(paragraph).toContain('Signature ability');
    expect(paragraph).toContain('href="/abilities#42"');
    expect(paragraph).toContain('Gain Fury below 50% Health.');
  });

  it('keeps each application form with its own paragraph and leaves missing targets unlinked', () => {
    const groups: ChampionKitSourceGroup[] = [
      { key: 'BUFF:GAIN', effectForm: 'BUFF', effectDirection: 'GAIN', synergies: [], nativeSources: [
        { key: 'buff', label: 'Special 1', condition: 'SP1 gains Fury.', target: null },
      ] },
      { key: 'PASSIVE:GAIN', effectForm: 'PASSIVE', effectDirection: 'GAIN', synergies: [], nativeSources: [
        { key: 'passive', label: 'Special 2', condition: 'SP2 gains Fury.', target: { recordId: '2', chapter: 'special2', title: 'Fury' } },
      ] },
    ];
    const html = renderToStaticMarkup(createElement(EffectSources, { effect: bleed, groups, abilityHref: target => `/abilities#${target.recordId}` }));
    const paragraphs = [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/g)].map(match => match[0]);
    expect(paragraphs[0]).toContain('Buff');
    expect(paragraphs[0]).not.toContain('<a ');
    expect(paragraphs[1]).toContain('Passive');
    expect(paragraphs[1]).toContain('href="/abilities#2"');
  });

  it('does not replace a partial word or interpret source prose as HTML', () => {
    const groups: ChampionKitSourceGroup[] = [{ key: 'UNKNOWN:GAIN', effectForm: 'UNKNOWN', effectDirection: 'GAIN', synergies: [],
      nativeSources: [{ key: 'source', label: 'Power', condition: 'Powerful hits work below <50% Health.', target: { recordId: '42', chapter: 'base', title: 'Power' } }] }];
    const html = renderToStaticMarkup(createElement(EffectSources, { effect: bleed, groups, abilityHref: () => '/abilities#42' }));
    expect(html).toContain('Powerful hits work below &lt;50% Health.');
    expect(html).not.toContain('>Powerful</span>');
    expect(html).not.toContain('>Buff</span>');
  });
});

describe('leveled synergy source display', () => {
  it('shows Galan\'s identical effect once even when the other recipient\'s catalog bonus differs', () => {
    const { groups } = galanSources();
    expect(groups[0].synergies).toHaveLength(3);
    const effect = { ...bleed, name: 'Heavy Attack Stun Charge' };
    const html = renderToStaticMarkup(createElement(EffectSources, { effect, groups, synergiesHref: '/champions/galan?tab=synergies' }));
    expect(html.match(/This non-stacking synergy grants/g)).toHaveLength(1);
    expect(html.match(/>Synergy<\/span>/g)).toHaveLength(1);
    expect(html.match(/href="\/champions\/galan\?tab=synergies"/g)).toHaveLength(1);
    expect(html).not.toContain('#champion-synergy-');
    expect(html).not.toContain('★');
    expect(html).not.toContain('Lv. undefined');
  });

  it('handles the recorded stacking annotation without losing Moon Knight\'s partner stars or metadata flag', () => {
    const summary = 'During Waning Moon, attacks can grant non-stacking Fury; duplicate synergy effects do not stack.';
    const taskmaster = { name: 'Taskmaster', slug: 'taskmaster', images: null };
    const entries = [3, 4].map(stars => ({ id: stars, type: 'ABILITY' as const, effectForm: 'BUFF' as const, effectDirection: 'GAIN' as const,
      source: `Synergy: TERMINATION CONTRACT (2★/3★/4★/5★/6★) with Taskmaster (${stars}★); text prohibits duplicate stacking despite non-unique metadata: Waning Moon grants Fury.`,
      overviewSummary: summary, ability: { name: 'Fury', iconUrl: null, gameGlossaryTermId: null, description: null, gameGlossaryTerm: null, categories: [] }, synergyChampions: [{ champion: taskmaster }],
    }));
    const cards = [3, 4].map(stars => ({ id: `termcontract_${stars}`, name: 'TERMINATION CONTRACT', unique: false, description: `Taskmaster gains ${stars * 10}% Evade chance. Moon Knight gains +10% trigger chance.`, partners: [{ ...taskmaster, id: 1, rarities: [stars] }] }));
    const groups = buildRosterKitDetails(entries, [], 2, cards).groups['GAIN:Fury'];
    expect(groups[0].synergies.map(row => row.partnerRarities)).toEqual([[3], [4]]);
    expect(groups[0].synergies.every(row => row.unique === false)).toBe(true);
    const html = renderToStaticMarkup(createElement(EffectSources, { effect: { ...bleed, name: 'Fury' }, groups, synergiesHref: '/champions/moon-knight?tab=synergies' }));
    expect(html.match(/During Waning Moon/g)).toHaveLength(1);
    expect(html.match(/href="\/champions\/moon-knight\?tab=synergies"/g)).toHaveLength(1);
    expect(html).not.toContain('★');
    expect(entries[0].source).toContain('text prohibits duplicate stacking despite non-unique metadata');
  });
  it('retains the actual three White Tiger levels and exposes their separate partner requirements', () => {
    const rows = whiteTigerSources()[0].synergies;
    expect(rows).toHaveLength(3);
    expect(rows.map(row => row.partnerRarities)).toEqual([[3], [4], [5, 6, 7]]);
    expect(rows.map(row => row.links[0].synergyId)).toEqual(['scream_04', 'scream_05', 'scream_06']);
  });

  it('shows the shared White Tiger summary once, with short level references and no inline star requirements', () => {
    const html = renderToStaticMarkup(createElement(EffectSources, { effect: bleed, groups: whiteTigerSources(), onViewSynergies: () => {} }));
    expect(html.match(/This synergy boosts Bleed potency/g)).toHaveLength(1);
    for (const level of [1, 2, 3]) expect(html).toContain(`View Bleed synergy: Bloody Marys - Lv. ${level}`);
    expect(html).not.toContain('★');
    expect(html).not.toContain('rarity:');
    expect(html.match(/>Synergy<\/span>/g)).toHaveLength(1);
  });

  it('keeps each synergy level link directed at its original card from roster popups', () => {
    const html = renderToStaticMarkup(createElement(EffectSources, { effect: bleed, groups: whiteTigerSources(), synergiesHref: '/champions/white-tiger?tab=synergies' }));
    for (const id of ['scream_04', 'scream_05', 'scream_06']) expect(html).toContain(`href="/champions/white-tiger?tab=synergies#champion-synergy-${id}"`);
  });

  it('keeps Robbie Reyes\' partner badges and level links without repeating activation metadata', () => {
    const champions = ['Dracula', 'Knull', 'Mephisto'].map(name => ({ name, slug: name.toLowerCase(), images: null }));
    const condition = 'All Champions gain Critical Damage Rating from this synergy.';
    const groups: ChampionKitSourceGroup[] = [{ key: 'UNKNOWN:GAIN', effectForm: 'UNKNOWN', effectDirection: 'GAIN', nativeSources: [],
      synergies: [1, 2, 3].map(level => ({ key: `rivals-${level}`, champions, unique: false,
        partnerRequirement: 'Knull (2★/3★/4★/5★/6★/7★) OR Mephisto (2★/3★/4★/5★/6★) OR Dracula (2★/3★/4★/5★/6★/7★)',
        links: [{ key: `rivals-${level}`, label: `RIVALS Lv. ${level}`, synergyId: `rivals_${level}`, rarities: level === 3 ? [5, 6, 7] : [level + 2], conditions: [condition] }],
      })) }];
    const original = structuredClone(groups);
    const html = renderToStaticMarkup(createElement(EffectSources, { effect: { ...bleed, name: 'Critical Damage Rating' }, groups, synergiesHref: '/champions/ghost-rider-robbie-reyes?tab=synergies' }));
    expect(html.match(/All Champions gain Critical Damage Rating/g)).toHaveLength(1);
    for (const champion of champions) expect(html.match(new RegExp(`href="/champions/${champion.slug}"`, 'g'))).toHaveLength(1);
    for (const level of [1, 2, 3]) {
      expect(html).toContain(`>Lv. ${level}</span>`);
      expect(html).toContain(`#champion-synergy-rivals_${level}`);
    }
    expect(html).not.toContain('★');
    expect(html).not.toContain(' OR ');
    expect(html).not.toContain('Champion 3');
    expect(groups).toEqual(original);
  });

  it('keeps different conditions, forms, directions, and numeric resistance contexts separate', () => {
    const original = whiteTigerSources();
    const differentCondition = structuredClone(original);
    differentCondition[0].synergies[1].links[0].conditions = ['Only while Blocking, gain this bonus.'];
    expect(renderToStaticMarkup(createElement(EffectSources, { effect: bleed, groups: differentCondition })).match(/This synergy boosts Bleed potency/g)).toHaveLength(1);
    const mixed = structuredClone(original);
    const passive = mixed[0].synergies.splice(1, 1);
    mixed.push({ key: 'PASSIVE:GAIN', effectForm: 'PASSIVE', effectDirection: 'GAIN', nativeSources: [], synergies: passive });
    expect(renderToStaticMarkup(createElement(EffectSources, { effect: bleed, groups: mixed })).match(/This synergy boosts Bleed potency/g)).toHaveLength(2);
    const values = structuredClone(original);
    values[0].synergies[1].links[0].values = [{ label: 'Potency', text: '12% potency reduction.' }];
    expect(renderToStaticMarkup(createElement(EffectSources, { effect: bleed, groups: values })).match(/This synergy boosts Bleed potency/g)).toHaveLength(2);
  });

  it.each(['family', 'stacking', 'missing-requirements', 'multiple-partners', 'resistance'])(
    'does not share a paragraph across different %s rules', difference => {
      const groups = whiteTigerSources();
      const row = groups[0].synergies[1];
      if (difference === 'family') row.links[0].label = 'Another Synergy - Lv. 2';
      if (difference === 'stacking') row.unique = true;
      if (difference === 'missing-requirements') { row.partnerRarities = undefined; row.partnerRequirement = undefined; }
      if (difference === 'multiple-partners') row.champions.push({ name: 'Havok', slug: 'havok', images: null });
      if (difference === 'resistance') row.links[0].resistance = { mechanism: 'POTENCY', percent: 80 };
      const html = renderToStaticMarkup(createElement(EffectSources, { effect: bleed, groups }));
      expect(html.match(/This synergy boosts Bleed potency/g)).toHaveLength(2);
    });
});

describe('recorded synergy bonus display', () => {
  it('shows the shared bonus and native links up front, with the original applications in a disclosure', () => {
    const critical = { recordId: '85519', chapter: 'base', title: 'Debuffs' };
    const special = { recordId: '85531', chapter: 'special2', title: 'Always Active' };
    const groups: ChampionKitSourceGroup[] = [{ key: 'DEBUFF:INFLICT', effectForm: 'DEBUFF', effectDirection: 'INFLICT',
      nativeSources: [
        { key: 'critical', label: 'Critical Hits', condition: 'Critical Hits inflict Bleed.', target: critical },
        { key: 'special', label: 'Special 2', condition: 'SP2 hits inflict Bleed, extra on Critical Hits.', target: special },
      ], synergies: [{ key: 'wisdom', champions: [{ name: 'Adam Warlock', slug: 'adam-warlock', images: null }], links: [{
        key: 'oky_02', synergyId: 'oky_02', label: 'Weapon & Warfare Wisdom',
        conditions: ['With a partner, Critical Hits inflict longer Bleed.', 'With a partner, SP2 inflicts longer Bleed.'],
        bonus: { text: '15% increased Debuff duration.', nonStacking: true, sources: [{ label: 'Critical Hits', target: critical }, { label: 'Special 2', target: special }] },
      }] }] }];
    const html = renderToStaticMarkup(createElement(EffectSources, { effect: bleed, groups, abilityHref: target => `/abilities#${target.recordId}`, synergiesHref: '/champions/okoye?tab=synergies' }));
    const details = html.match(/<details\b[\s\S]*?<\/details>/)?.[0] ?? '';
    expect(details).toContain('Source details');
    expect(details).not.toMatch(/<details[^>]*\sopen(?:[\s=>])/);
    expect(details).toContain('With a partner, Critical Hits inflict longer Bleed.');
    expect(details).toContain('With a partner, SP2 inflicts longer Bleed.');
    const compact = html.slice(0, html.indexOf('<details'));
    expect(compact).toContain('15% increased Debuff duration. Does not stack.');
    expect(compact).not.toContain('With a partner,');
    expect(compact).toContain('#champion-synergy-oky_02');
    const applies = compact.match(/<p\b[^>]*>Applies to[\s\S]*?<\/p>/)?.[0] ?? '';
    expect(applies).toContain('href="/abilities#85519"');
    expect(applies).toContain('href="/abilities#85531"');
  });
});

describe('recorded resistance values', () => {
  it('renders numeric context beside the preserved condition in the shared source component', () => {
    const effect: ChampionKitEffect = { name: 'Bleed', type: 'RESISTANCE', iconUrl: null, color: '#fff', secondaryColor: '#000', description: null, sources: [] };
    const groups: ChampionKitSourceGroup[] = [{ key: 'UNKNOWN:GAIN', effectForm: 'UNKNOWN', effectDirection: 'GAIN', synergies: [],
      nativeSources: [{ key: 'signature', label: 'Signature ability', condition: 'Incoming Bleed effects have reduced duration with his signature.', target: null,
        resistance: { mechanism: 'DURATION', percent: null }, values: [{ label: 'Sig 1', text: 'Incoming Bleed effects suffer -10.8% duration.' }] }] }];
    const html = renderToStaticMarkup(createElement(EffectSources, { effect, groups }));
    expect(html).toContain('data-resistance-values');
    expect(html).toContain('Sig 1');
    expect(html).toContain('-10.8% duration');
    expect(html).toContain('with his signature');
    expect(html).not.toContain('Immunity');
  });

  it('keeps a single synergy source compact, with rarity requirements available through its link', () => {
    const effect: ChampionKitEffect = { name: 'Bleed', type: 'ABILITY', iconUrl: null, color: '#fff', secondaryColor: '#000', description: null, sources: [] };
    const groups: ChampionKitSourceGroup[] = [{ key: 'PASSIVE:INFLICT', effectForm: 'PASSIVE', effectDirection: 'INFLICT', nativeSources: [],
      synergies: [{ key: 'cross-training', champions: [{ name: 'Punisher 2099', slug: 'punisher-2099', images: null }], partnerRarities: [2, 3, 4, 5, 6, 7],
        links: [{ key: 'cross-training', label: 'Cross Training', conditions: ['His signature may inflict passive Bleed.'], rarities: [2, 3, 4, 5, 6, 7] }] }] }];
    const html = renderToStaticMarkup(createElement(EffectSources, { effect, groups, synergiesHref: '/champions/punisher?tab=synergies' }));
    expect(html.match(/His signature may inflict passive Bleed\./g)).toHaveLength(1);
    expect(html).toContain('Punisher 2099');
    expect(html).not.toContain('★');
    expect(html).not.toContain('rarity:');
    expect(html).toContain('/champions/punisher?tab=synergies');
  });
});
