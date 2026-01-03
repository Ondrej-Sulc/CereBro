import { NextRequest } from 'next/server';
import busboy, { FileInfo } from 'busboy';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import logger from '@cerebro/core/services/loggerService';

interface ParsedFormData {
  fields: Record<string, string>;
  tempFilePath: string | null;
}

export const parseFormData = (req: NextRequest): Promise<ParsedFormData> => {
  return new Promise((resolve, reject) => {
    const headers = Object.fromEntries(req.headers.entries());
    const bb = busboy({ headers: headers });
    const fields: Record<string, string> = {};
    let tempFilePath: string | null = null;

    bb.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: FileInfo) => {
      const { filename } = info;
      const tempDir = os.tmpdir();
      
      // Generate a secure, random filename to prevent path traversal.
      const randomName = crypto.randomBytes(16).toString('hex');
      const extension = path.extname(filename);
      const safeFilename = randomName + extension;
      tempFilePath = path.join(tempDir, safeFilename);

      const writeStream = fs.createWriteStream(tempFilePath);
      file.pipe(writeStream);

      file.on('end', () => {
        // File finished writing
      });
    });

    bb.on('field', (fieldname: string, val: string) => {
      fields[fieldname] = val;
    });

    bb.on('finish', () => {
      resolve({ fields, tempFilePath });
    });

    const cleanup = () => {
      if (tempFilePath) {
          fs.unlink(tempFilePath, (err) => {
              if (err) logger.error({ err, tempFilePath }, "Failed to cleanup temp file");
          });
      }
    };

    bb.on('error', (err) => {
      cleanup();
      reject(err);
    });

    if (req.body) {
        const reader = req.body.getReader();
        const pump = () => {
            reader.read().then(({ done, value }) => {
                if (done) {
                    bb.end();
                    return;
                }
                bb.write(value);
                pump();
            }).catch((err) => {
                cleanup();
                reject(err);
            });
        };
        pump();
    } else {
        bb.end();
    }
  });
};