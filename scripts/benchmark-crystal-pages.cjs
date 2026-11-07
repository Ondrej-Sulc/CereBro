// Run against `next start`, with no compiler or test process competing for CPU.
// Usage: node scripts/benchmark-crystal-pages.cjs http://localhost:3001 [report.json]
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const routes = [
  '/crystals', '/crystals?scope=all', '/crystals?scope=all&q=banquet',
  '/crystals/7_star_hero_shard_crystal', '/crystals/paragon_crystal_v2',
  '/crystals/greater_banquet_crystal_dec22',
  '/crystals/champions?champion=gwenom', '/crystals/compare',
];

async function main() {
  const origin = new URL(process.argv[2] || 'http://localhost:3001');
  const results = [];
  for (const route of routes) {
    const samples = [];
    for (let cycle = 0; cycle < 4; cycle++) {
      const start = performance.now();
      const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(90000) });
      const ttfbMs = performance.now() - start;
      const body = Buffer.from(await response.arrayBuffer());
      if (response.status !== 200) throw new Error(`${route}: HTTP ${response.status}`);
      samples.push({ ttfbMs, totalMs: performance.now() - start, bytes: body.length, gzipBytes: zlib.gzipSync(body).length });
    }
    const warm = samples.slice(1);
    const median = key => Math.round(warm.map(sample => sample[key]).sort((a, b) => a - b)[1] * 10) / 10;
    const result = { path: route, firstRequestMs: Math.round(samples[0].totalMs * 10) / 10,
      warmMs: median('totalMs'), ttfbMs: median('ttfbMs'), bytes: warm[0].bytes, gzipBytes: warm[0].gzipBytes };
    results.push(result);
    console.log(JSON.stringify(result));
  }
  if (process.argv[3]) {
    const destination = path.resolve(process.argv[3]);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, `${JSON.stringify(results, null, 2)}\n`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
