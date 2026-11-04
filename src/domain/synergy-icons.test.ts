import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../data/synergy-icons.json';
import { getGameSynergyIcon } from './synergy-icons';

describe('native synergy icons', () => {
  it('resolves every verified source identity and checks every extracted asset hash', () => {
    const ids = new Set<string>();
    for (const glyph of manifest.glyphs) {
      const bytes = fs.readFileSync(`web/public${glyph.src}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(glyph.sha256);
      for (const id of glyph.synergyIds) {
        ids.add(id);
        expect(getGameSynergyIcon(id, { id, texture: glyph.texture })).toBe(glyph.src);
      }
    }
    expect(ids.size).toBe(manifest.verifiedRecords);
    expect(manifest.unresolved).toEqual([]);
  });

  it('uses source texture rather than English names or an old ID mapping', () => {
    const first = manifest.glyphs[0], second = manifest.glyphs[1];
    expect(getGameSynergyIcon('new_id', { id: 'new_id', texture: first.texture, name: 'Unrelated name' })).toBe(first.src);
    expect(getGameSynergyIcon('new_id', { id: 'new_id', texture: second.texture })).toBe(second.src);
  });

  it('leaves absent, unknown, ambiguous and mismatched source metadata without an icon', () => {
    for (const raw of [null, [], {}, { texture: 'B' }, { id: 'other', texture: 'B' }, { id: 'id', texture: '\u{10ffff}' }, { id: 'id', texture: 'BB' }]) {
      expect(getGameSynergyIcon('id', raw)).toBeNull();
    }
  });
});
