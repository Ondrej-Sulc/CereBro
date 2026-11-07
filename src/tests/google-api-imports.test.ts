import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('keeps unrelated Google API declarations out of the application type graph', () => {
  const configFile = ts.readConfigFile(path.resolve('web/tsconfig.json'), ts.sys.readFile);
  expect(configFile.error).toBeUndefined();
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.resolve('web'));
  const program = ts.createProgram([
    'src/services/youtubeService.ts',
    'src/services/sheetsService.ts',
    'web/src/app/api/admin/youtube/auth/route.ts',
    'web/src/app/api/admin/youtube/callback/route.ts',
  ].map(file => path.resolve(file)), { ...config.options, incremental: false });
  const apis = new Set(program.getSourceFiles().flatMap(file => {
    const match = file.fileName.replaceAll('\\', '/').match(/\/googleapis\/build\/src\/apis\/([^/]+)\//);
    return match ? [match[1]] : [];
  }));

  // The package root eagerly brings in every API, including multi-megabyte
  // Compute/AI declarations. Check resolved dependencies, not import spelling.
  expect([...apis].sort()).toEqual(['sheets', 'youtube']);
}, 30_000);
