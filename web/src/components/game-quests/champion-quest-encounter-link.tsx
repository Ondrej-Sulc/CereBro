import Link from "next/link";

/** A lazy navigation entry: no encounter catalog is sent to champion pages. */
export function ChampionQuestEncounterLink({ gameId }: { gameId: string | null }) {
  if (!gameId) return null;
  return <section className="mt-6 rounded-xl border border-white/10 p-5">
    <h2 className="text-lg font-semibold text-white">Quest encounters</h2>
    <p className="mt-2 text-sm text-slate-400">Find this champion as an opponent on captured quest maps.</p>
    <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-sky-300 underline underline-offset-4" href={`/quests/encounters?gameId=${encodeURIComponent(gameId)}`}>Browse recorded encounters →</Link>
  </section>;
}
