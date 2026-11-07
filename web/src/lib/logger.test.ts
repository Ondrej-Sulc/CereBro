import { spawnSync } from "node:child_process"
import path from "node:path"
import { expect, it } from "vitest"

it("reuses one logger across module reloads and retains the current request context", () => {
  const script = `
    const fs = require('node:fs');
    const ts = require('typescript');
    const path = require('node:path');
    require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
    const directory = path.resolve('web/src/lib');
    const loggers = new Set();
    const contexts = new Set();
    const counts = [];
    for (let cycle = 0; cycle < 12; cycle++) {
      for (const name of ['logger.ts', 'request-context.ts', 'expected-framework-errors.ts']) delete require.cache[path.join(directory, name)];
      const logger = require(path.join(directory, 'logger.ts')).default;
      const { requestContextStorage } = require(path.join(directory, 'request-context.ts'));
      loggers.add(logger); contexts.add(requestContextStorage);
      requestContextStorage.run({correlationId:'reload-'+cycle}, () => logger.info({reloadProbe:true}, 'Reload context probe'));
      counts.push(process.listenerCount('exit'));
    }
    console.log(JSON.stringify({reloadReport:true,loggers:loggers.size,contexts:contexts.size,counts}));
  `
  const result = spawnSync(process.execPath, ["-e", script], { cwd: path.resolve("."), encoding: "utf8", timeout: 15000,
    env: { ...process.env, NODE_ENV: "development", LOG_LEVEL: "info" } })
  expect(result.status, result.stderr).toBe(0)
  const rows: Record<string, unknown>[] = result.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line) as Record<string, unknown>)
  const report = rows.find(row => row.reloadReport)!
  expect(report.loggers).toBe(1)
  expect(report.contexts).toBe(1)
  const counts = report.counts as number[]
  expect(counts.every(count => count === counts[0])).toBe(true)
  expect(rows.filter(row => row.reloadProbe).map(row => row.correlationId)).toEqual(Array.from({ length: 12 }, (_, cycle) => `reload-${cycle}`))
}, 20000)
