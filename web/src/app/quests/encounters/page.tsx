import Link from "next/link";
import { findChampionEncounters, findQuest } from "@cerebro/core/data/game-quests";
import { hierarchyLabel } from "@cerebro/core/domain/game-quests";
import { QuestProvenance } from "@/components/game-quests/quest-provenance";
export const metadata = { title: "Champion quest encounters | CereBro" };
export default async function ChampionEncountersPage({ searchParams }: { searchParams: Promise<{ gameId?: string | string[] }> }) {
  const params = await searchParams;
  const gameId = typeof params.gameId === "string" ? params.gameId : "";
  const occurrences = findChampionEncounters(gameId);
  const questIds = [...new Set(occurrences.map(e => e.questId))];
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8"><Link href="/quests" className="text-sm text-sky-300">← Quest explorer</Link><p className="mt-8 text-xs uppercase tracking-widest text-sky-400">Opponent lookup</p><h1 className="mt-3 break-words text-3xl font-bold">{occurrences[0]?.name || "Champion quest encounters"}</h1><p className="mt-4 text-slate-400">{occurrences.length} placed encounters in {questIds.length} captured maps.</p><details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer">Character data</summary><p className="mt-2 break-all">Exact gameId: {gameId || "not specified"}</p></details>
    <div className="mt-8 space-y-4">{questIds.map(id => { const q = findQuest(id)!; return <section key={id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"><h2 className="text-xl font-semibold">{hierarchyLabel(q)} · {q.name}</h2><p className="mt-1 text-sm text-slate-400">{q.section}{q.difficultyId && ` · ${q.difficultyId}`}</p><div className="mt-4 flex flex-wrap gap-3">{occurrences.filter(e => e.questId === id).map(e => <Link prefetch={false} key={e.encounterId} className="rounded-lg border border-slate-700 px-3 py-3 text-sm text-sky-200 hover:border-sky-500" href={`/quests/${encodeURIComponent(id)}?${new URLSearchParams({ path: String(e.pathIndices[0] ?? 0), node: e.coordinate.join(",") })}`}>{e.rarity}★ · {e.final?"Boss encounter":"Recorded encounter"}{e.final ? " · Final" : ""}<span className="mt-1 block text-xs text-slate-400">{e.pathIndices.length ? `Recorded routes ${e.pathIndices.map(i => i + 1).join(", ")}` : "Outside recorded routes"}</span></Link>)}</div></section>; })}</div>
    {!occurrences.length && <p className="mt-8 rounded-xl border border-slate-800 p-5 text-slate-400">No exact placed match in the 234 captured permanent layouts. Summary-only entries and boss previews do not establish opponent placements.</p>}<QuestProvenance />
  </div>;
}
