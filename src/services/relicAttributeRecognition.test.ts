import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { rankRelicAttributes, recognizeRelicAttribute } from './relicAttributeRecognition';

describe('Statcast attribute glyph recognition', () => {
  it('recognizes actual screenshot glyphs including attributes with the same background color', async () => {
    const fixture = JSON.parse(await readFile('src/tests/fixtures/relic-screenshots/attribute-icons.json', 'utf8')) as { expected: string[] };
    const { data, info } = await sharp('src/tests/fixtures/relic-screenshots/attribute-icons.png').removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [index, expected] of fixture.expected.entries()) {
      const result = recognizeRelicAttribute(data, info.width, info.height, { x: index * 32 + 2, y: 2, width: 28, height: 28 });
      expect(rankRelicAttributes(data, info.width, info.height, { x: index * 32 + 2, y: 2, width: 28, height: 28 })[0]?.attribute).toBe(expected);
      // These two tiny glyphs do not meet the confidence/margin threshold. Preserve manual review.
      if ([16, 17].includes(index)) expect(result, `uncertain glyph ${index}`).toBeNull();
      else expect(result?.attribute, `screenshot glyph ${index}`).toBe(expected);
    }
  });
  it('leaves blank, clipped and unrelated artwork unrecognized', async () => {
    const blank = Buffer.alloc(32 * 32 * 3, 30);
    expect(recognizeRelicAttribute(blank, 32, 32, { x: 0, y: 0, width: 32, height: 32 })).toBeNull();
    expect(recognizeRelicAttribute(blank, 32, 32, { x: -2, y: 0, width: 32, height: 32 })).toBeNull();
    const white = Buffer.alloc(32 * 32 * 3, 255);
    expect(recognizeRelicAttribute(white, 32, 32, { x: 0, y: 0, width: 32, height: 32 })).toBeNull();
  });
  it.each([.5, .75, 1.25, 1.5])('abstains instead of changing identity at scale %s', async scale => {
    const fixture = JSON.parse(await readFile('src/tests/fixtures/relic-screenshots/attribute-icons.json', 'utf8')) as { expected: string[] };
    const { data, info } = await sharp('src/tests/fixtures/relic-screenshots/attribute-icons.png')
      .resize({ width: Math.round(992 * scale) }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let recognized = 0;
    fixture.expected.forEach((expected, index) => {
      const result = recognizeRelicAttribute(data, info.width, info.height, { x: (index * 32 + 2) * scale, y: 2 * scale, width: 28 * scale, height: 28 * scale });
      if (result) { expect(result.attribute, `scaled glyph ${index}`).toBe(expected); recognized++; }
    });
    expect(recognized).toBeGreaterThanOrEqual(7);
  });
});
