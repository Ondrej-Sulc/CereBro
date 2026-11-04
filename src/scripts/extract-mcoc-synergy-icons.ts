import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import opentype from 'opentype.js';
import { parseMcocSynergiesJson } from '../services/mcocSynergiesImportService';

const argument = (name: string) => {
  const value = process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!value) throw new Error(`Missing --${name}= (see docs/synergy-icons.md)`);
  return value;
};
const checksum = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');

const snapshotBytes = fs.readFileSync(argument('snapshot'));
const catalog = parseMcocSynergiesJson(snapshotBytes.toString('utf8'));
const fontBytes = fs.readFileSync(argument('font'));
const evidence = JSON.parse(fs.readFileSync(argument('evidence'), 'utf8')) as {
  fontSha256: string; snapshotSha256: string; sourceSha256: string; verifiedRecords: number;
};
if (checksum(fontBytes) !== evidence.fontSha256 || checksum(snapshotBytes) !== evidence.snapshotSha256
  || catalog.metadata.sourceSha256 !== evidence.sourceSha256 || catalog.synergies.length !== evidence.verifiedRecords) {
  throw new Error('Source/font changed after native binding verification');
}
const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
const root = path.resolve(argument('root'));
const publicDir = path.join(root, 'web/public/icons/synergies');
fs.mkdirSync(publicDir, { recursive: true });
const glyphs: Array<{ texture: string; codepoint: number; glyphIndex: number; src: string; sha256: string; synergyIds: string[] }> = [];
const unresolved: Array<{ texture: string; synergyIds: string[]; reason: string }> = [];
const byTexture = new Map<string, string[]>();
for (const row of catalog.synergies) byTexture.set(row.texture, [...(byTexture.get(row.texture) ?? []), row.id]);
for (const [texture, synergyIds] of [...byTexture].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
  // A few game strings have trailing CR/tab. Keep their exact raw identity in the
  // manifest; these controls have no visible outline. Never truncate real glyphs.
  const visible = texture.replace(/[\t\r\n]/g, '');
  const glyph = font.charToGlyph(visible);
  const outline = glyph.getPath(0, 0, 128);
  if ([...visible].length !== 1 || glyph.index === 0 || !outline.commands.length) {
    unresolved.push({ texture, synergyIds, reason: 'Missing or ambiguous native glyph' });
    continue;
  }
  const box = outline.getBoundingBox();
  const codepoint = visible.codePointAt(0)!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x1} ${box.y1} ${box.x2 - box.x1} ${box.y2 - box.y1}">${outline.toSVG(3)}</svg>\n`;
  const sha256 = checksum(svg);
  const filename = `u${codepoint.toString(16)}-${sha256.slice(0, 12)}.svg`;
  fs.writeFileSync(path.join(publicDir, filename), svg);
  glyphs.push({ texture, codepoint, glyphIndex: glyph.index, src: `/icons/synergies/${filename}`, sha256, synergyIds: synergyIds.sort() });
}
const manifest = { schemaVersion: 1, ...evidence, glyphs, unresolved };
fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/synergy-icons.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ records: catalog.synergies.length, textures: byTexture.size, glyphs: glyphs.length, unresolved }, null, 2));
