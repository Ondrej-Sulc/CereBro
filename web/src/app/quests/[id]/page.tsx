import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuestArtwork } from "@cerebro/core/data/game-quests/artwork";
import { findQuest, loadQuestMap, isArchivedQuest } from "@cerebro/core/data/game-quests";
import { QuestPageHeader } from "@/components/game-quests/quest-page-header";
import { loadQuestPortraits,loadRewardPortraits } from "@/lib/game-quests/champions";
import { projectQuestRewards,projectRewardRecord } from "@/lib/game-quests/presentation";
import { getQuestRewardRecord,getParentRewardRecord,hasRecordedRewards } from "@cerebro/core/data/game-quests/rewards";
import { QuestRewards } from "@/components/game-quests/quest-rewards";
import { QuestMapExplorer } from "@/components/game-quests/quest-map-explorer";
import { loadUnplacedQuestDefenders } from "@cerebro/core/data/game-quests/unplaced-defenders";
import { QuestUnplacedDefenders } from "@/components/game-quests/quest-unplaced-defenders";
import { loadQuestSpawnRegions } from "@cerebro/core/data/game-quests/spawn-regions";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ path?: string; node?: string; region?: string; application?: string; sourceHash?:string }> };
export async function generateMetadata({ params }: Props) { const q = findQuest((await params).id); return { title: `${q?.name ?? "Quest not found"} | CereBro` }; }
export default async function QuestPage({ params, searchParams }: Props) {
  const id=(await params).id;
  const q = findQuest(id);
  if (!q && isArchivedQuest(id)) return <div className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-3xl font-semibold">Outside the permanent collection</h1><p className="my-6 leading-7 text-slate-400">This archived definition is outside the Story and permanent Special quest explorer. Monthly events and Daily quests are excluded from browsing, maps and opponent discovery here. This does not establish its current availability in the game.</p><Link href="/quests" className="text-sky-300">Explore permanent quests →</Link></div>;
  if (!q) notFound();
  const map = await loadQuestMap(q.id);
  const spawnRegions = map ? await loadQuestSpawnRegions(map) : undefined;
  const unplaced = spawnRegions?.regions.length ? undefined : await loadUnplacedQuestDefenders({ ...q, mapSourceHash: map?.sourceHash });
  const selection = await searchParams;
  const rewardRecord=getQuestRewardRecord(q);
  const parentRewards=q.hierarchy.map(h=>({h,act:hasRecordedRewards(getParentRewardRecord([q],"act",h.actId)),chapter:hasRecordedRewards(getParentRewardRecord([q],"chapter",h.chapterId))})).filter(p=>p.act||p.chapter);
  const portraits = map ? await loadQuestPortraits(map) : rewardRecord?await loadRewardPortraits(rewardRecord):{};
  const artwork = getQuestArtwork(q.id);
  const rewards = map ? projectQuestRewards(map, portraits) : rewardRecord?projectRewardRecord(rewardRecord,portraits):[];
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8"><Link href="/quests" className="text-sm text-sky-300">← Quest explorer</Link>
    <QuestPageHeader quest={q} />
    {unplaced && <a href="#unplaced-defender-previews" className="my-4 inline-flex min-h-11 items-center text-sm text-sky-300">Additional defender previews →</a>}
    {parentRewards.length>0&&<nav aria-label="Quest rewards context" className="my-5 flex flex-wrap gap-4 text-sm text-sky-300">{parentRewards.map(({h,act,chapter})=><span key={h.actId+h.chapterId}>{act&&<Link href={`/quests?${new URLSearchParams(q.section==="Special"?{category:"Special",collection:q.containerSetName}:{category:"Story",act:h.actId})}#act-rewards`}>Act rewards</Link>}{act&&chapter&&" / "}{chapter&&<Link href={`/quests?${new URLSearchParams({category:q.section??q.category,...(q.section==="Special"?{collection:q.containerSetName}:{act:h.actId}),chapter:h.chapterId})}#chapter-rewards`}>Chapter rewards</Link>}</span>)}</nav>}
    {map && selection.sourceHash && selection.sourceHash!==map.sourceHash && <p className="mb-5 text-sm text-amber-200">This application link refers to another saved source version. The current recorded map is shown.</p>}
    {(q.scalingCurve || (map?.adaptive)) && <p className="mb-5 rounded-lg border border-amber-900/60 bg-amber-950/20 p-4 text-sm leading-6 text-amber-200">Opponents and rewards scale with progression.{q.minProgressionRank !== null && ` Shown for progression rank ${q.minProgressionRank}${q.maxProgressionRank !== q.minProgressionRank ? `–${q.maxProgressionRank}` : ""}.`} Recorded builds may differ for another profile.</p>}
    {map ? <QuestMapExplorer key={`${map.questId}:${map.sourceHash}:${selection.path ?? ""}:${selection.node ?? ""}:${selection.region ?? ""}:${selection.application ?? ""}`} map={map} artwork={artwork} portraits={portraits} spawnRegions={spawnRegions} initialRegion={selection.region} initialPath={selection.path} initialNode={selection.node} initialApplication={selection.sourceHash && selection.sourceHash!==map.sourceHash ? undefined : selection.application} /> : <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 sm:p-9"><span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">Summary only</span><h2 className="mt-5 text-2xl font-semibold">This map has not been captured</h2><p className="mt-3 max-w-2xl leading-7 text-slate-400">The quest definition is browseable. Its routes, geometry, placed opponents and node applications are unavailable in this snapshot.</p><Link href="/quests?coverage=full-map" className="mt-6 inline-flex min-h-11 items-center text-sm text-sky-300">Explore captured layouts →</Link></section>}
    <QuestRewards rewards={rewards} />
    {unplaced && <div id="unplaced-defender-previews" className="scroll-mt-24"><QuestUnplacedDefenders data={unplaced} /></div>}
  </div>;
}
