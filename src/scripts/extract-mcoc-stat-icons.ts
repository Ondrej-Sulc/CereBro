import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import opentype from 'opentype.js';

interface StatBinding {
  nativeId: string;
  texture: string;
  color: string;
  contexts: string[];
  nameStringId: string;
  recordSha256: string;
}
interface Evidence {
  schemaVersion: number;
  source: { fontSha256: string };
  stats: Record<string, StatBinding>;
}

const argument = (name: string): string => {
  const value = process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!value) throw new Error(`Missing --${name}= (see docs/stat-icons.md)`);
  return value;
};
const checksum = (data: Uint8Array | string): string => createHash('sha256').update(data).digest('hex');
const evidence = JSON.parse(fs.readFileSync(argument('evidence'), 'utf8')) as Evidence;
const fontBytes = fs.readFileSync(argument('font'));
if (checksum(fontBytes) !== evidence.source.fontSha256) throw new Error('Font changed after binding verification');
if (evidence.schemaVersion !== 1 || Object.keys(evidence.stats).length !== 11) throw new Error('Expected 11 verified stat bindings');
const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
const root = path.resolve(argument('root'));
const publicDir = path.join(root, 'web/public/icons/stats');
fs.mkdirSync(publicDir, { recursive: true });
const icons: Record<string, { src: string; color: string }> = {};
const glyphs: Record<string, StatBinding & { codepoint: number; glyphIndex: number; src: string; sha256: string }> = {};
for (const [key, binding] of Object.entries(evidence.stats)) {
  const glyph = font.charToGlyph(binding.texture);
  const outline = glyph.getPath(0, 0, 128);
  if ([...binding.texture].length !== 1 || glyph.index === 0 || !outline.commands.length) {
    throw new Error(`Missing or ambiguous native glyph for ${key}`);
  }
  const box = outline.getBoundingBox();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x1} ${box.y1} ${box.x2 - box.x1} ${box.y2 - box.y1}">${outline.toSVG(3)}</svg>\n`;
  const filename = `${key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}.svg`;
  const src = `/icons/stats/${filename}`;
  fs.writeFileSync(path.join(publicDir, filename), svg);
  icons[key] = { src, color: binding.color };
  glyphs[key] = { ...binding, codepoint: binding.texture.codePointAt(0)!, glyphIndex: glyph.index, src, sha256: checksum(svg) };
}
fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/stat-icons.json'), JSON.stringify({ schemaVersion: 1, icons }, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'docs/stat-icons-source.json'), JSON.stringify({ ...evidence, stats: glyphs, unresolved: [] }, null, 2) + '\n');
console.log(JSON.stringify({ glyphs: Object.keys(glyphs).length, unresolved: [] }));
