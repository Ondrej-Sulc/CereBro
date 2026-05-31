import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import expectations from './fixtures/roster-ascension-level-expectations.json';
import { rosterImageService } from '../services/rosterImageService.js';
import { GridCell } from '../services/roster/types.js';

const TEST_IMAGES_DIR = path.join(process.cwd(), 'src', 'tests', 'fixtures', 'roster-images');

function groupRows(grid: GridCell[]): GridCell[][] {
  const sorted = [...grid].sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
  const rows: GridCell[][] = [];

  for (const cell of sorted) {
    const row = rows.find((candidate) => Math.abs(candidate[0].bounds.y - cell.bounds.y) < cell.bounds.height * 0.5);
    if (row) {
      row.push(cell);
    } else {
      rows.push([cell]);
    }
  }

  return rows.map((row) => row.sort((a, b) => a.bounds.x - b.bounds.x));
}

vi.mock('../services/googleVisionService.js', () => {
  return {
    getGoogleVisionService: async () => {
      return {
        detectText: async (imageBuffer: Buffer) => {
          const hash = createHash('md5').update(imageBuffer).digest('hex');
          const cachePath = path.join(process.cwd(), 'src', 'tests', 'fixtures', 'roster-ocr', `${hash}.json`);
          const data = await fs.readFile(cachePath, 'utf-8');
          return JSON.parse(data);
        }
      };
    }
  };
});

describe('RosterImageService ascension-level fixtures', () => {
  let imagesAvailable = false;

  beforeAll(async () => {
    try {
      await fs.access(TEST_IMAGES_DIR);
      imagesAvailable = true;
    } catch {
      console.warn(`Test images directory not found at ${TEST_IMAGES_DIR}. Skipping ascension-level fixtures.`);
    }
  });

  for (const [filename, expected] of Object.entries(expectations)) {
    test(`should detect ascension levels in ${filename}`, async () => {
      if (!imagesAvailable) return;

      const filePath = path.join(TEST_IMAGES_DIR, filename);
      try {
        await fs.access(filePath);
      } catch {
        console.warn(`Skipping ${filename} (file missing)`);
        return;
      }

      const buffer = await fs.readFile(filePath);
      const { grid } = await rosterImageService.processBGView(buffer, { debugMode: true });
      const rows = groupRows(grid);

      for (const [rowIndex, expectedLevels] of expected.rows.entries()) {
        const actualLevels = rows[rowIndex]
          .slice(0, expectedLevels.length)
          .map((cell) => cell.ascensionLevel || 0);

        expect(actualLevels).toEqual(expectedLevels);
      }
    }, 30000);
  }
});
