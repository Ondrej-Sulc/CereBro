import { NextRequest } from 'next/server';
import busboy, { FileInfo } from 'busboy';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import logger from "@/lib/logger";

interface ParsedFormData {
  fields: Record<string, string>;
  tempFilePath: string | null;
}

export const parseFormData = async (req: NextRequest): Promise<ParsedFormData> => {
  return new Promise(async (resolve, reject) => {
    try {
      const headers = Object.fromEntries(req.headers.entries());
      const bb = busboy({ headers: headers });
      const fields: Record<string, string> = {};
      let tempFilePath: string | null = null;
      const fileWritePromises: Promise<void>[] = [];

      bb.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: FileInfo) => {
        const { filename } = info;
        const tempDir = os.tmpdir();
        
        // Generate a secure, random filename to prevent path traversal.
        const randomName = crypto.randomBytes(16).toString('hex');
        const extension = path.extname(filename);
        const safeFilename = randomName + extension;
        tempFilePath = path.join(tempDir, safeFilename);

        const writeStream = fs.createWriteStream(tempFilePath);
        
        // Use stream pipeline for individual file streams as well
        const { pipeline } = require('stream');
        const writePromise = new Promise<void>((resolveWrite, rejectWrite) => {
          pipeline(file, writeStream, (err: any) => {
            if (err) {
              rejectWrite(err);
            } else {
              resolveWrite();
            }
          });
        });
        
        // Attach a dummy catch to prevent unhandled rejections if busboy crashes 
        // the main pipeline stream before Promise.all is called
        writePromise.catch(() => {});
        fileWritePromises.push(writePromise);
      });

      bb.on('field', (fieldname: string, val: string) => {
        fields[fieldname] = val;
      });

      bb.on('finish', async () => {
        try {
          await Promise.all(fileWritePromises);
          resolve({ fields, tempFilePath });
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      const cleanup = () => {
        if (tempFilePath) {
          fs.unlink(tempFilePath, (err) => {
            if (err && err.code !== 'ENOENT') {
              logger.error({ err, tempFilePath }, "Failed to cleanup temp file");
            }
          });
        }
      };

      bb.on('error', (err) => {
        logger.error({ 
            err, 
            headers: Object.keys(headers).length ? headers : undefined, 
            contentLength: headers['content-length'] 
        }, "Busboy emitted error during formal data parsing");
        cleanup();
        reject(err);
      });

      if (req.body) {
        // Use Node.js stream utility to properly handle backpressure and chunks
        const { Readable, pipeline } = require('stream');
        const nodeStream = Readable.fromWeb(req.body as any);
        
        nodeStream.on('aborted', () => {
            logger.warn({ contentLength: headers['content-length'] }, "Client aborted the stream prematurely (e.g. timeout or closed tab)");
        });

        // Use pipeline to safely pipe and catch unhandled stream destruction errors
        pipeline(nodeStream, bb, (err: any) => {
            if (err && err.message === 'Unexpected end of form') {
                logger.warn("Pipeline successfully caught 'Unexpected end of form' due to client stream drop");
            } else if (err) {
                logger.error({ err }, "Stream pipeline encountered an error");
            }
        });
      } else {
        bb.end();
      }
    } catch (err) {
      reject(err);
    }
  });
};