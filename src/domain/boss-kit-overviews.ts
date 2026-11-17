import { createHash } from "node:crypto";
import { z } from "zod";
import { overviewSourceHash, validateOverviewSummaries, type OverviewSource } from "./champion-overview-summary";
import { artifactHash } from "./champion-effect-enrichment";

const effect = z.object({
  abilityId: z.number().int().positive(), name: z.string().min(1),
  type: z.enum(["ABILITY", "IMMUNITY"]), effectForm: z.enum(["BUFF", "DEBUFF", "PASSIVE", "UNKNOWN"]),
  effectDirection: z.enum(["GAIN", "INFLICT", "UNKNOWN"]), source: z.string().min(1).max(2000).nullable(),
  summary: z.string().trim().min(1).max(360), existingLinkId: z.number().int().positive().optional(),
  evidence: z.array(z.object({ textId: z.number().int().positive(), quote: z.string().min(12).max(10000) }).strict()).min(1),
  reason: z.string().min(5),
}).strict();
export const bossOverviewDraftSchema = z.object({
  author: z.string().min(1), snapshotSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  champions: z.array(z.object({ gameId: z.string().min(1), effects: z.array(effect) }).strict()),
  held: z.array(z.unknown()),
}).strict();
export type BossOverviewDraft = z.infer<typeof bossOverviewDraftSchema>;
type Link = Omit<OverviewSource, "name" | "synergyChampionIds">;
export type BossOverviewSnapshot = {
  champions: Array<{ id: number; gameId: string | null; isPlayable: boolean }>;
  abilities: Array<{ id: number; name: string }>;
  texts: Array<{ id: number; championId: number; sourceId: string; rawText: string; combat: boolean }>;
  links: Link[];
  overviews: Array<{ championAbilityLinkId: number }>;
};

/** Adds reviewed applications and display copy; existing applications require an exact explicit binding. */
export function planBossKitOverviews(snapshot: BossOverviewSnapshot, rawDrafts: readonly unknown[], allowedGameIds: readonly string[]) {
  const allowed = new Set(allowedGameIds);
  const champions = new Map(snapshot.champions.map(row => [row.gameId, row]));
  const abilities = new Map(snapshot.abilities.map(row => [row.id, row]));
  const texts = new Map(snapshot.texts.map(row => [row.id, row]));
  const occupied = new Set(snapshot.overviews.map(row => row.championAbilityLinkId));
  const seen = new Set<string>();
  const seenExisting = new Set<number>();
  const rows = rawDrafts.flatMap(raw => {
    const draft = bossOverviewDraftSchema.parse(raw);
    return draft.champions.flatMap(boss => {
      const champion = champions.get(boss.gameId);
      if (!allowed.has(boss.gameId) || !champion || champion.isPlayable
        || /^(?:ex_|(?:pvp_)?adaptoid|sentinel|symbioid|sym_|lab_gold_|(?:enforced_)?doombot)/.test(boss.gameId)) throw new Error("Boss is outside the reviewed scope");
      return boss.effects.map(proposal => {
        const ability = abilities.get(proposal.abilityId);
        if (!ability || ability.name !== proposal.name) throw new Error("Canonical ability identity differs");
        if (proposal.type === "IMMUNITY" && proposal.effectDirection !== "UNKNOWN") throw new Error("Immunity direction must remain unknown");
        const citations = proposal.evidence.map(citation => {
          const text = texts.get(citation.textId);
          if (!text || text.championId !== champion.id || !text.rawText.includes(citation.quote)) throw new Error("Boss source quote differs");
          return { ...citation, sourceId: text.sourceId, rawSha256: createHash("sha256").update(text.rawText).digest("hex"), combat: text.combat };
        });
        if (!citations.some(citation => citation.combat)) throw new Error("A glossary definition alone cannot establish an application");
        const before = proposal.existingLinkId === undefined ? undefined : snapshot.links.find(link => link.id === proposal.existingLinkId);
        if (proposal.existingLinkId !== undefined && (!before || before.championId !== champion.id || occupied.has(before.id) || seenExisting.has(before.id))) throw new Error("Existing application binding differs");
        if (before) {
          seenExisting.add(before.id);
          if (before.source !== proposal.source || before.type !== proposal.type || before.effectForm !== proposal.effectForm || before.effectDirection !== proposal.effectDirection) throw new Error("Existing source metadata must be preserved");
          if (before.abilityId !== proposal.abilityId && !(boss.gameId === "ares" && before.id === 20647
            && abilities.get(before.abilityId)?.name === "Unblockable" && ability.name === "Can't Be Blocked")) throw new Error("Unreviewed existing association correction");
        }
        const identity = JSON.stringify([champion.id, proposal.abilityId, proposal.type, proposal.source, proposal.effectForm, proposal.effectDirection]);
        if (seen.has(identity) || (!before && snapshot.links.some(link => JSON.stringify([link.championId, link.abilityId, link.type, link.source, link.effectForm, link.effectDirection]) === identity))) throw new Error("Duplicate boss application");
        seen.add(identity);
        return { ...proposal, gameId: boss.gameId, championId: champion.id, author: draft.author, citations, before: before ?? null };
      });
    });
  });
  // Temporary positive IDs validate the content without consuming a database sequence.
  const sources: OverviewSource[] = rows.map((row, i) => ({ id: row.existingLinkId ?? 100_000_000 + i, championId: row.championId,
    abilityId: row.abilityId, name: row.name, type: row.type, source: row.source, effectForm: row.effectForm,
    effectDirection: row.effectDirection, synergyChampionIds: [] }));
  const documents = snapshot.texts.map(text => ({ id: `text:${text.id}`, text: text.rawText }));
  const input = { sources, documents };
  validateOverviewSummaries(input, { schemaVersion: 1, author: "boss-kit-curators", snapshotHash: artifactHash(input),
    entries: rows.map((row, i) => ({ championId: row.championId, linkId: sources[i].id, sourceHash: overviewSourceHash(sources[i]),
      summary: row.summary, evidence: row.evidence.map(citation => ({ documentId: `text:${citation.textId}`, quote: citation.quote })), retainedValues: [] })) });
  return { rows, sources, contentHash: artifactHash(rows) };
}
