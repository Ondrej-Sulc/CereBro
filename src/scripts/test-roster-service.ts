
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
    
    // Optional: Log raw OCR descriptions for debugging
    const visionService = await getGoogleVisionService();
    // const rawDetections = await visionService.detectText(buffer);
    // console.log("Raw OCR Texts:", rawDetections.slice(0, 50).map((d: any) => d.description));

    const result = await rosterImageService.processStatsView(buffer, { debugMode: true });
    
    if (result.debugImage) {
      const debugPath = path.join(path.dirname(imagePath), 'debug-' + path.basename(imagePath));
      await fs.writeFile(debugPath, result.debugImage);
      console.log(`Saved debug image to ${debugPath}`);
      delete result.debugImage; // Don't log the buffer
    }

    // Clean up buffers from logging to avoid massive output
    result.grid.forEach(cell => {
      if (cell.debugInfo?.bestMatchBuffer) {
        delete cell.debugInfo.bestMatchBuffer;
      }
    });

    console.log("Result:", JSON.stringify(result, null, 2));
    console.log("Success! Grid size:", result.grid.length);
  } catch (error) {
    console.error("Error:", error);
  }
}

testProcessing();
