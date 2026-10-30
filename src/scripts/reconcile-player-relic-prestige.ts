import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { open, mkdir } from "node:fs/promises";
import path from "node:path";
import { reconcilePlayerRelicPrestige } from "../services/playerPrestigeService";

// One-off rollout and follow-up to catalog/curve changes. Reads never change totals.
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--apply" && !arg.startsWith("--output=") && !arg.startsWith("--player=")))
    throw new Error("Unknown reconciliation option.");
  const output = args.find(arg => arg.startsWith("--output="))?.slice(9);
  const playerId = args.find(arg => arg.startsWith("--player="))?.slice(9);
  if (!output) throw new Error("Usage: pnpm reconcile:relic-prestige --output=NEW_REPORT.jsonl [--player=ID] [--apply]");
  if (playerId !== undefined && !playerId.trim()) throw new Error("--player requires a non-empty profile ID.");
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  const report = await open(output, "wx"); // Never replace an earlier rollout record.
  const append = async (entry: unknown) => {
    await report.writeFile(JSON.stringify(entry) + "\n");
    await report.sync();
  };
  const db = new PrismaClient();
  const apply = args.includes("--apply");
  try {
    await append({ event: "start", at: new Date().toISOString(), apply, playerId: playerId ?? null });
    const players = await db.player.findMany({
      where: playerId ? { id: playerId } : { OR: [{ relics: { some: {} } }, { relicPrestigeFromInventory: true }] },
      select: { id: true }, orderBy: { id: "asc" },
    });
    if (playerId && players.length === 0) throw new Error("Player profile not found.");
    let changed = 0, applied = 0, eligible = 0;
    for (const player of players) {
      const preview = await reconcilePlayerRelicPrestige(db, player.id);
      await append({ event: "preview", ...preview });
      if (preview.ready) eligible++;
      if (preview.changed) changed++;
      if (apply) {
        // Recompute under locks, rather than applying potentially stale preview totals.
        const result = await reconcilePlayerRelicPrestige(db, player.id, { apply: true });
        await append({ event: "result", ...result });
        if (result.applied) applied++;
      }
    }
    const summary = { event: "complete", at: new Date().toISOString(), players: players.length, eligible, changed, applied };
    await append(summary);
    console.log(JSON.stringify(summary));
  } catch (error) {
    await append({ event: "failed", at: new Date().toISOString(), message: error instanceof Error ? error.message : "Reconciliation failed" });
    throw error;
  } finally {
    await db.$disconnect();
    await report.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Reconciliation failed");
  process.exitCode = 1;
});
