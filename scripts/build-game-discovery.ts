import { writeFile, mkdir } from "node:fs/promises";
import { buildDiscovery } from "../src/data/game-discovery/build";
import { packDiscovery } from "../src/domain/game-discovery";

async function main() {
  const output = process.argv[2] ?? "src/data/game-discovery/index.json";
  const data = await buildDiscovery();
  await mkdir(output.replace(/[\\/][^\\/]+$/, ""), { recursive: true });
  await writeFile(output, JSON.stringify(packDiscovery(data)) + "\n");
  console.log(JSON.stringify({ ...data.coverage, nodes: Object.keys(data.nodes).length, rewards: Object.keys(data.rewards).length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
