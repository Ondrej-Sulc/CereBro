import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { rankRelicAttributes, recognizeRelicAttribute } from './relicAttributeRecognition';

describe('Statcast attribute glyph recognition', () => {
  it('recognizes the primary/secondary glyphs across all 36 follow-up cards, including penetration arrows', async () => {
    const fixtures = JSON.parse(await readFile('src/tests/fixtures/relic-screenshots/variant-icons.json', 'utf8')) as {
      screenshot: string; card: number; slot: string; expected: string; box: {x:number;y:number;width:number;height:number};
    }[];
    const {data, info} = await sharp('src/tests/fixtures/relic-screenshots/variant-icons.png').removeAlpha().raw().toBuffer({resolveWithObject:true});
    for (const fixture of fixtures) {
      expect(recognizeRelicAttribute(data, info.width, info.height, fixture.box)?.attribute,
        `${fixture.screenshot} card ${fixture.card} ${fixture.slot}`).toBe(fixture.expected);
    }
  });
  it('recognizes actual screenshot glyphs including attributes with the same background color', async () => {
    const fixture = JSON.parse(await readFile('src/tests/fixtures/relic-screenshots/attribute-icons.json', 'utf8')) as { expected: string[] };
    const { data, info } = await sharp('src/tests/fixtures/relic-screenshots/attribute-icons.png').removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [index, expected] of fixture.expected.entries()) {
      const result = recognizeRelicAttribute(data, info.width, info.height, { x: index * 32 + 2, y: 2, width: 28, height: 28 });
      expect(rankRelicAttributes(data, info.width, info.height, { x: index * 32 + 2, y: 2, width: 28, height: 28 })[0]?.attribute).toBe(expected);
      // This tiny Block Proficiency glyph still lacks a safe margin. Preserve manual review.
      if (index === 17) expect(result, `uncertain glyph ${index}`).toBeNull();
      else expect(result?.attribute, `screenshot glyph ${index}`).toBe(expected);
    }
  });
  it.each([.5, .75, 1.25, 1.5])('does not confuse follow-up variants at scale %s', async scale => {
    const fixtures = JSON.parse(await readFile('src/tests/fixtures/relic-screenshots/variant-icons.json', 'utf8')) as {
      expected:string; box:{x:number;y:number;width:number;height:number};
    }[];
    const {data, info} = await sharp('src/tests/fixtures/relic-screenshots/variant-icons.png')
      .resize({width:Math.round(2880*scale)}).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let recognized = 0;
    for (const {box, expected} of fixtures) {
      const result = recognizeRelicAttribute(data,info.width,info.height,{x:box.x*scale,y:box.y*scale,width:box.width*scale,height:box.height*scale});
      if (result) { expect(result.attribute).toBe(expected); recognized++; }
    }
    expect(recognized).toBeGreaterThanOrEqual(scale === .5 ? 20 : 30);
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
