
import { rosterImageService } from '../services/rosterImageService';
import { getGoogleVisionService } from '../services/googleVisionService';
import fs from 'fs/promises';
import path from 'path';

async function testProcessing() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error("Please provide an image path");
    process.exit(1);
  }

  console.log(`Processing ${imagePath}...`);
  try {
    const buffer = await fs.readFile(imagePath);

    const visionService = await getGoogleVisionService();
    const rawDetections = await visionService.detectText(buffer);

    const { createHash } = await import('crypto');
    const os = await import('os');
    const hash = createHash('md5').update(buffer).digest('hex');
    const ocrDir = path.join(os.tmpdir(), 'cerebro-ocr');
    await fs.mkdir(ocrDir, { recursive: true });
    const ocrPath = path.join(ocrDir, `${hash}.json`);

    await fs.writeFile(ocrPath, JSON.stringify(rawDetections, null, 2));
    console.log(`Saved raw OCR results to ${ocrPath}`);

    const result = await rosterImageService.processBGView(buffer, { debugMode: true });

    if (result.debugImage) {
      const debugPath = path.join(path.dirname(imagePath), 'debug-' + path.basename(imagePath));
      await fs.writeFile(debugPath, result.debugImage);
      console.log(`Saved debug image to ${debugPath}`);
      delete result.debugImage; // Don't log the buffer
    }

    const formattedExpectation = result.grid.map(cell => ({
      class: cell.class,
      name: cell.championName,
      stars: cell.stars,
      rank: cell.rank || 0,
      sig: cell.sigLevel !== undefined ? cell.sigLevel : 0,
      ascended: cell.isAscended || false,
      pi: cell.powerRating || 0
    }));

    console.log(`\n\n--- EXPECTATION FORMAT FOR ${path.basename(imagePath)} ---`);
    console.log(`  "${path.basename(imagePath)}": ` + JSON.stringify(formattedExpectation, null, 2).replace(/\n/g, '\n  ') + ',');
    console.log("---------------------------------------------------\n\n");
  } catch (error) {
    console.error("Error:", error);
  }
}

testProcessing();
