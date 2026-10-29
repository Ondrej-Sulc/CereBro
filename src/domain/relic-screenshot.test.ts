import { describe, expect, it } from 'vitest';
import { matchRelicScreenshot, type ScreenshotRelic } from './relic-screenshot';

const ant: ScreenshotRelic = {
  relicId: 'ant', name: 'Ant-Man', shortName: 'Ant-Man', className: 'SCIENCE', type: 'battlecast',
  stars: 6, secondaryAttribute: null, ranks: [
    { rank: 3, socketRanks: {}, prestigeBySignature: [1400, 1962] },
    { rank: 4, socketRanks: {}, prestigeBySignature: [1500, 1962] },
  ],
};
const observation = { name: 'ANT - MAN', rating: 1962, stars: 6, awakened: true, className: 'SCIENCE' };
describe('relic screenshot build inference', () => {
  it('retains every exact rank/signature collision, without choosing the highest rank', () => {
    expect(matchRelicScreenshot(observation, [ant])).toMatchObject([
      { relicId: 'ant', rank: 3, sigLevel: 1 }, { relicId: 'ant', rank: 4, sigLevel: 1 },
    ]);
  });
  it('does not round, interpolate or choose a nearest prestige', () => {
    expect(matchRelicScreenshot({ ...observation, rating: 1961 }, [ant])).toEqual([]);
  });
  it('uses rarity, class and awakening as constraints and leaves unknowns open', () => {
    expect(matchRelicScreenshot({ ...observation, awakened: false }, [ant])).toEqual([]);
    expect(matchRelicScreenshot({ ...observation, stars: 5 }, [ant])).toEqual([]);
    expect(matchRelicScreenshot({ ...observation, className: 'TECH' }, [ant])).toEqual([]);
    expect(matchRelicScreenshot({ ...observation, stars: null, awakened: null }, [ant])).toHaveLength(2);
  });
  it('does not conflate statcast variants with the same name and prestige', () => {
    const variants = ['Armor', 'Critical Rating'].map((secondaryAttribute, i) => ({ ...ant,
      relicId: `stat-${i}`, shortName: 'Sturdy Relic', type: 'statcast', secondaryAttribute,
    }));
    expect(matchRelicScreenshot({ ...observation, name: 'STURDY RELIC' }, variants)).toHaveLength(4);
    expect(matchRelicScreenshot({ ...observation, name: 'STURDY RELIC', secondaryAttribute: 'Armor' }, variants)).toHaveLength(2);
  });
  it('never matches an unrecognized name or a missing curve', () => {
    expect(matchRelicScreenshot({ ...observation, name: 'MY RELICS' }, [ant])).toEqual([]);
    expect(matchRelicScreenshot(observation, [{ ...ant, ranks: null }])).toEqual([]);
    expect(matchRelicScreenshot({...observation,attributeStatus:'conflict'}, [ant])).toEqual([]);
  });
});
