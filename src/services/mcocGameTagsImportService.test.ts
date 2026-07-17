import { describe, expect, it } from 'vitest';
import {
  buildGenderMapFromHeroTiers,
  parseMcocChampionTagsJson,
  parseMcocGameTagsJson,
  parseMcocHeroTiersJson,
} from './mcocGameTagsImportService';

describe('mcocGameTagsImportService', () => {
  it('parses the three static game data files', () => {
    expect(parseMcocChampionTagsJson('{"hero":{"full_name":"HERO","champion_tags":[]}}'))
      .toHaveProperty('hero.full_name', 'HERO');
    expect(parseMcocGameTagsJson('{"tags":{"hero":{"name":"Hero","category_name":"Attributes"}}}'))
      .toHaveProperty('tags.hero.name', 'Hero');
    expect(parseMcocHeroTiersJson('{"hero_t7":{"id":"hero_t7","tags":["male"]}}'))
      .toHaveProperty('hero_t7.id', 'hero_t7');
  });

  it('rejects malformed tag files', () => {
    expect(() => parseMcocGameTagsJson('[]')).toThrow('expected a JSON object');
    expect(() => parseMcocGameTagsJson('{}')).toThrow('expected a tags object');
  });

  it('infers gender across rarity tier suffixes and resolves ties consistently', () => {
    const { genderByGameId, sourceGenderTiers } = buildGenderMapFromHeroTiers({
      hero_t7: { tags: ['male'] },
      hero_t6: { tags: ['male'] },
      heroine_t7: { size: 'female' },
      tied_t7: { tags: ['male'] },
      tied_t6: { tags: ['female'] },
    });

    expect(sourceGenderTiers).toBe(5);
    expect(genderByGameId.get('hero')).toBe('Male');
    expect(genderByGameId.get('heroine')).toBe('Female');
    expect(genderByGameId.get('tied')).toBe('Female');
  });
});
