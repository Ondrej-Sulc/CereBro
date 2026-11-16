import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// Exercise the real client import graph; framework and CSS handling belong to Next.
// Use Vite's locked bundler dependency rather than adding a second build tool.
const tooling = createRequire(import.meta.url);
const vite = createRequire(tooling.resolve('vitest/config'));
const bundler = createRequire(vite.resolve('vite/package.json'))('esbuild') as {
  build(options: {
    absWorkingDir: string; entryPoints: string[]; bundle: boolean; write: boolean;
    platform: 'browser'; format: 'esm'; tsconfig: string; external: string[]; logLevel: 'silent';
  }): Promise<{ errors: unknown[] }>;
};

it('bundles effect autocomplete for the browser without Node-only dependencies', async () => {
  await expect(bundler.build({
    absWorkingDir: fileURLToPath(new URL('../../../../', import.meta.url)),
    entryPoints: ['web/src/app/glossary/glossary-search-form.tsx'],
    bundle: true, write: false, platform: 'browser', format: 'esm', tsconfig: 'web/tsconfig.json',
    external: ['next/*', 'react', 'react/*', 'react-dom', 'react-dom/*', 'lucide-react', '*.css'],
    logLevel: 'silent',
  })).resolves.toMatchObject({ errors: [] });
});
