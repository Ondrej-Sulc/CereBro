
import { rosterImageService } from '../services/rosterImageService.js';
import fs from 'fs/promises';
import path from 'path';
import expectations from './fixtures/roster-expectations.json';
import { describe, test, beforeAll, expect, vi } from 'vitest';
import { createHash } from 'crypto';

// Mock Google Vision Service to use cached OCR results
vi.mock('../services/googleVisionService.js', () => {
  return {
    getGoogleVisionService: async () => {
      return {
        detectText: async (imageBuffer: Buffer) => {
          const hash = createHash('md5').update(imageBuffer).digest('hex');
          const cachePath = path.join(process.cwd(), 'src', 'tests', 'fixtures', 'roster-ocr', `${hash}.json`);
          try {
            const data = await fs.readFile(cachePath, 'utf-8');
            return JSON.parse(data);
          } catch (error) {
            console.warn(`[Mock Vision] Cache miss for hash ${hash}. Make sure to run 'generate-ocr-fixtures.ts'.`);
            throw new Error(`OCR Cache miss for ${hash}`);
          }
        }
      };
    }
  };
});

// Define where the test images are located.
// Ideally these should be in the repo, but for now we point to temp/testimages.
// Adjust this path if you move the images.
const TEST_IMAGES_DIR = path.join(process.cwd(), 'src', 'tests', 'fixtures', 'roster-images');

describe('RosterImageService Integration Tests', () => {
  // Ensure the directory exists before running tests
  let imagesAvailable = false;

  beforeAll(async () => {
    try {
      await fs.access(TEST_IMAGES_DIR);
      imagesAvailable = true;
    } catch {
      console.warn(`Test images directory not found at ${TEST_IMAGES_DIR}. Skipping integration tests.`);
    }
  });

  const testFiles = Object.keys(expectations);

  for (const filename of testFiles) {
    const expected = expectations[filename as keyof typeof expectations];

    test(`should correctly process ${filename}`, async () => {
      if (!imagesAvailable) {
        console.warn(`Skipping ${filename} (images dir missing)`);
        return;
      }

      const filePath = path.join(TEST_IMAGES_DIR, filename);
      
      // Check if individual file exists
      try {
        await fs.access(filePath);
      } catch {
        console.warn(`Skipping ${filename} (file missing)`);
        return;
      }

      const buffer = await fs.readFile(filePath);
      const { grid } = await rosterImageService.processStatsView(buffer, { debugMode: false });

      // Transform actual grid to match expectation structure for deep comparison
      const actualSimplified = grid.map(cell => ({
        class: cell.class || null,
        name: cell.championName || null,
        stars: cell.stars || null,
        rank: cell.rank || null,
        sig: cell.sigLevel !== undefined ? cell.sigLevel : null,
        ascended: cell.isAscended || false,
        pi: cell.powerRating || null
      }));

      // Check counts first for easier debugging
      const championCount = grid.filter(c => c.championName).length;
      const expectedChampionCount = expected.filter((c: any) => c.name).length;
      expect(championCount).toBe(expectedChampionCount);
      expect(grid.length).toBe(expected.length);

      // Deep comparison
      // We assume the order is consistent because the sorting logic in service is deterministic
      // and we generated expectations from the same logic.
      expect(actualSimplified).toEqual(expected);
    }, 30000); // 30s timeout per image
  }
});
