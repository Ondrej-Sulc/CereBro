import manifest from '../data/synergy-icons.json';

const byTexture = new Map(manifest.glyphs.map(glyph => [glyph.texture, glyph.src]));

/** Resolve the imported native field, never a localized name or a guessed ID alias.
 * Unknown glyphs stay absent until a new source font is extracted and verified.
 */
export function getGameSynergyIcon(id: string, raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  if (source.id !== id || typeof source.texture !== 'string') return null;
  return byTexture.get(source.texture) ?? null;
}
