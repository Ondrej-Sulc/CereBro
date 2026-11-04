import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../data/stat-icons.json';

const root = path.resolve(__dirname, '../..');
const evidence = JSON.parse(fs.readFileSync(path.join(root, 'docs/stat-icons-source.json'), 'utf8')) as {
  stats: Record<string, { nativeId: string; texture: string; color: string; src: string; sha256: string }>;
  unresolved: string[];
};

describe('verified native champion stat assets', () => {
  it('keeps the game stat IDs, glyphs and category colors distinct', () => {
    const expected = {
      criticalRating: ['crit_rating', 'P', '#a99024'],
      criticalDamageRating: ['crit_damage', 'D', '#a99024'],
      armorPenetration: ['armor_pen', '\ue460', '#872d13'],
      blockPenetration: ['block_pen', '\ue690', '#712986'],
      criticalResistance: ['crit_hit_resist', 'q', '#a99024'],
      armorRating: ['armor', 'a', '#117986'],
      blockProficiency: ['block_proficiency', 'B', '#115526'],
      physicalResistance: ['resist_physical', 'u', '#11772f'],
      energyResistance: ['resist_magic', 't', '#724986'],
      health: ['health', 'H', '#11772f'],
      attack: ['attack', 'W', '#82542b'],
    };
    expect(Object.keys(manifest.icons).sort()).toEqual(Object.keys(expected).sort());
    expect(Object.fromEntries(Object.entries(evidence.stats).map(([key, stat]) =>
      [key, [stat.nativeId, stat.texture, stat.color]]))).toEqual(expected);
    expect(evidence.unresolved).toEqual([]);
  });

  it('serves exactly the verified vector bytes and omits unverified multiplier artwork', () => {
    for (const [key, icon] of Object.entries(manifest.icons)) {
      const source = evidence.stats[key];
      expect(icon).toEqual({ src: source.src, color: source.color });
      const asset = fs.readFileSync(path.join(root, 'web/public', icon.src));
      expect(createHash('sha256').update(asset).digest('hex')).toBe(source.sha256);
      expect(asset.toString('utf8')).toMatch(/^<svg[^>]+viewBox="[^"]+"><path d="/);
      expect(asset.toString('utf8')).not.toMatch(/<image|<script|href=|\r/);
    }
    expect(manifest.icons).not.toHaveProperty('specialDamageMultiplier');
  });
});
