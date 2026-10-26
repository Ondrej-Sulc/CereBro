import { z } from "zod";
import { parseRelicPrestigeRanks, type RelicPrestigeRank } from "./relic-prestige";

const sockets = z.record(z.string().regex(/^[0-4]$/), z.number().int().min(1).max(100));
const identity = {
  Id: z.string().regex(/^[a-z0-9_]+$/),
  RarityId: z.string().regex(/^[a-z0-9_]+$/),
  Rank: z.number().int().min(1).max(6),
  InnateAbilityLevel: z.number().int().min(0).max(200),
};
export const relicPrestigeRequestSchema = z.object({ ...identity, SocketRanks: sockets }).strict();
const responseSchema = z.object({
  event: z.literal("response"), error: z.literal(""),
  request: z.array(relicPrestigeRequestSchema).min(1).max(1000),
  result: z.array(z.object({ ...identity, Pi: z.number().int().positive(),
    Sockets: z.record(z.string().regex(/^[0-4]$/), z.object({ Rank: z.number().int().min(1).max(100) }).strict()),
  }).strict()).min(1).max(1000),
}).passthrough();
const planSchema = z.array(z.object({
  relicId: identity.Id, rarityId: identity.RarityId,
  maxSignature: z.number().int().min(0).max(200),
  ranks: z.array(z.object({ rank: identity.Rank, socketRanks: sockets }).strict()).min(1).max(6),
}).strict()).min(1);
export type RelicPrestigePlan = z.infer<typeof planSchema>;
export type RelicPrestigeTable = { relicId: string; rarityId: string; ranks: RelicPrestigeRank[] };
type Build = z.infer<typeof relicPrestigeRequestSchema>;
const socketKey = (value: Record<string, number>) => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
export const relicPrestigeBuildKey = (b: Build) => `${b.Id}:${b.RarityId}:${b.Rank}:${b.InnateAbilityLevel}:${socketKey(b.SocketRanks)}`;

/** Verifies exact request/response association; no positional matching or interpolation. */
export class RelicPrestigeCapture {
  private readonly plan: RelicPrestigePlan;
  private readonly profiles = new Map<string, { sockets: string; values: Array<number | undefined> }>();
  readonly expectedCount: number;
  private received = 0;
  constructor(value: unknown) {
    this.plan = planSchema.parse(value);
    const identities = new Set<string>();
    for (const entry of this.plan) {
      const id = `${entry.relicId}:${entry.rarityId}`;
      if (identities.has(id)) throw new Error("Duplicate plan identity");
      identities.add(id);
      entry.ranks.forEach((rank, index) => {
        if (rank.rank !== index + 1) throw new Error("Incomplete plan ranks");
        this.profiles.set(`${id}:${rank.rank}`, { sockets: socketKey(rank.socketRanks),
          values: Array.from({ length: entry.maxSignature + 1 }, () => undefined) });
      });
    }
    this.expectedCount = [...this.profiles.values()].reduce((sum, p) => sum + p.values.length, 0);
  }
  addResponse(value: unknown) {
    const event = responseSchema.parse(value);
    if (event.request.length !== event.result.length) throw new Error("Response count mismatch");
    const requested = new Set(event.request.map(relicPrestigeBuildKey));
    if (requested.size !== event.request.length) throw new Error("Duplicate requested build");
    const additions: Array<{ values: Array<number | undefined>; signature: number; pi: number }> = [];
    for (const result of event.result) {
      const build: Build = { Id: result.Id, RarityId: result.RarityId, Rank: result.Rank,
        InnateAbilityLevel: result.InnateAbilityLevel,
        SocketRanks: Object.fromEntries(Object.entries(result.Sockets).map(([key, v]) => [key, v.Rank])) };
      if (!requested.delete(relicPrestigeBuildKey(build))) throw new Error("Unexpected or duplicate response build");
      const profile = this.profiles.get(`${build.Id}:${build.RarityId}:${build.Rank}`);
      if (!profile || profile.sockets !== socketKey(build.SocketRanks) || build.InnateAbilityLevel >= profile.values.length)
        throw new Error("Response differs from source plan");
      if (profile.values[build.InnateAbilityLevel] !== undefined) throw new Error("Duplicate captured build");
      additions.push({ values: profile.values, signature: build.InnateAbilityLevel, pi: result.Pi });
    }
    for (const row of additions) row.values[row.signature] = row.pi;
    this.received += additions.length;
  }
  finish(): RelicPrestigeTable[] {
    if (this.received !== this.expectedCount) throw new Error(`Incomplete capture: ${this.received}/${this.expectedCount}`);
    return this.plan.map(entry => ({ relicId: entry.relicId, rarityId: entry.rarityId,
      ranks: parseRelicPrestigeRanks(entry.ranks.map(rank => ({ ...rank,
        prestigeBySignature: this.profiles.get(`${entry.relicId}:${entry.rarityId}:${rank.rank}`)!.values,
      })), { maxRank: entry.ranks.length, maxSignature: entry.maxSignature }),
    }));
  }
}
