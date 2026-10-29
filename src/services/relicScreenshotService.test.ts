import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { parseRelicScreenshot } from './relicScreenshotService';
import type { ScreenshotRelic } from '../domain/relic-screenshot';
import type { VisionTextDetection } from './googleVisionService';

const fixture = 'src/tests/fixtures/relic-screenshots/';
describe('relic screenshot recognition', () => {
  it('reads the exposed lower frame when relic art obscures the upper frame and star tips', async () => {
    const [image, source, evidence] = await Promise.all(['tech-cards.webp','tech-catalog.json','tech-cards.ocr.json'].map(name => readFile(fixture+name)));
    const parsed = await parseRelicScreenshot(image,JSON.parse(source.toString()),JSON.parse(evidence.toString()));
    expect(parsed).toHaveLength(6);
    expect(parsed.find(row => row.name === 'HULKBUSTER')).toMatchObject({stars:6,awakened:true,rating:1520});
    expect(parsed.filter(row => row.name === 'STURDY RELIC').map(row => row.secondaryAttribute)).toEqual(['Physical Resistance','Armor','Critical Rating']);
  });
  it('keeps rarity unknown when frame and star evidence are obscured, even with matching prestige', async () => {
    const [image, source, evidence] = await Promise.all(['tech-cards.webp','tech-catalog.json','tech-cards.ocr.json'].map(name => readFile(fixture+name)));
    const hiddenFrame = await sharp({create:{width:14,height:111,channels:3,background:'#222'}}).png().toBuffer();
    const obscured = await sharp(image).composite([{input:hiddenFrame,left:1136,top:103}]).png().toBuffer();
    const parsed = await parseRelicScreenshot(obscured,JSON.parse(source.toString()),JSON.parse(evidence.toString()));
    const hulkbuster = parsed.find(row => row.name === 'HULKBUSTER')!;
    expect(hulkbuster.stars).toBeNull();
    expect(hulkbuster.matches.map(match => match.stars)).toEqual([6,6]);
  });
  it('reads actual card plates, class, stars and awakening, retaining Ant-Man’s two exact matches', async () => {
    const [image, source, evidence] = await Promise.all(['cards.webp', 'catalog.json', 'cards.ocr.json'].map(name => readFile(fixture+name)));
    const catalog: ScreenshotRelic[] = JSON.parse(source.toString());
    const detections: VisionTextDetection[] = JSON.parse(evidence.toString());
    const parsed = await parseRelicScreenshot(image, catalog, detections);
    expect(parsed).toHaveLength(6);
    const ant = parsed.find(row => row.name === 'ANT - MAN')!;
    expect(ant).toMatchObject({ rating: 1962, stars: 6, awakened: true, className: 'SCIENCE' });
    expect(ant.matches.map(m=>[m.rank,m.sigLevel])).toEqual([[3,187],[4,87]]);
    expect(parsed.filter(row=>row.name==='THE COSMIC EGG').map(row=>row.stars)).toEqual([7,6]);
    // The small attached champion portrait is never used as the relic identity.
    expect(parsed.some(row=>row.name.includes('SPIDER'))).toBe(false);
    const precise = parsed.find(row=>row.name==='PRECISE RELIC')!;
    expect(precise).toMatchObject({ primaryAttribute:'Critical Rating', secondaryAttribute:'Special Damage', attributeStatus:'recognized' });
    expect(precise.matches).toHaveLength(1);
    expect(precise.matches[0].secondaryAttribute).toBe('Special Damage');
    for (const row of parsed) expect(row.bounds.x+row.bounds.width).toBeLessThanOrEqual(1);
  });
  it('works at a different screenshot scale without another OCR call', async () => {
    const [image, source, evidence] = await Promise.all(['cards.webp', 'catalog.json', 'cards.ocr.json'].map(name=>readFile(fixture+name)));
    const detections: VisionTextDetection[] = JSON.parse(evidence.toString());
    const scaled = detections.map(d=>({...d,boundingPoly:{vertices:d.boundingPoly.vertices.map(v=>({x:Math.round((v.x??0)*.75),y:Math.round((v.y??0)*.75)}))}}));
    const parsed = await parseRelicScreenshot(await sharp(image).resize({width:Math.round(1655*.75)}).png().toBuffer(), JSON.parse(source.toString()), scaled);
    expect(parsed).toHaveLength(6);
    expect(parsed.find(row=>row.name==='ANT - MAN')!.matches).toContainEqual(expect.objectContaining({rank:4,sigLevel:87}));
  });
  it('does not invent rows for a blank or unrelated screenshot', async () => {
    const image = await sharp({create:{width:1000,height:500,channels:3,background:'#222'}}).png().toBuffer();
    await expect(parseRelicScreenshot(image, [], [])).rejects.toThrow(/No complete relic cards/);
  });
  it('does not accept a secondary icon when the primary contradicts the catalog family', async () => {
    const [image, source, evidence] = await Promise.all(['cards.webp', 'catalog.json', 'cards.ocr.json'].map(name=>readFile(fixture+name)));
    const catalog: ScreenshotRelic[] = JSON.parse(source.toString());
    const parsed = await parseRelicScreenshot(image, catalog.map(r=>r.shortName === 'Precise Relic' ? {...r,primaryAttribute:'Armor'} : r), JSON.parse(evidence.toString()));
    expect(parsed.find(row=>row.name==='PRECISE RELIC')).toMatchObject({attributeStatus:'conflict',matches:[]});
  });
});
