import Image from "next/image";
import Link from "next/link";
import { Gem } from "lucide-react";
import { RewardItemOverlay } from "@/components/reward-item-overlay";
import { questRewardScope, type QuestRewardView } from "@/lib/game-quests/presentation";

export function QuestRewards({ rewards,title="Quest rewards",id="quest-rewards" }: { rewards: QuestRewardView[];title?:string;id?:string }) {
  if (!rewards.length) return null;
  const scopes = [...new Set(rewards.map(r => r.scope))];
  const outcomes=rewards.filter(r=>r.recordedOutcome);
  return <section id={id} className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6">
    <h2 className="text-xl font-semibold">{title}</h2>
    <div className="mt-5 grid gap-7 md:grid-cols-2">{scopes.filter(scope=>rewards.some(r=>r.scope===scope&&!r.recordedOutcome)).map(scope => <section key={scope}><h3 className="mb-3 text-sm font-medium text-slate-400">{questRewardScope(scope)}</h3><ul className="space-y-2">{rewards.filter(r => r.scope === scope&&!r.recordedOutcome).map(r => <li key={r.key} className="flex items-center gap-3 rounded-lg bg-slate-800/40 p-3">
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">{r.imageUrl ? <Image src={r.imageUrl} width={56} height={56} sizes="56px" alt="" className="object-contain" /> : <Gem aria-hidden="true" className="h-7 w-7 text-slate-500" />}<RewardItemOverlay rank={r.rankChange} signaturePoints={r.signaturePoints} rarity={r.itemRarity}/></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium leading-6">{r.href ? <Link className="text-sky-200 hover:underline" href={r.href}>{r.rarity && `${r.rarity}★ `}{r.name} ↗</Link> : r.name}</p><p className="text-xs text-slate-400">{r.placeholder?"Native definition contains a placeholder.":`${r.type === "champion" ? "Champion" : r.type==="crystal"?"Crystal":r.sourceType==="gf"?"Crystal shards":r.sourceType==="ebpf"?"Fragments":r.sourceType==="res"?"Resource":r.sourceType==="utitle"?"Title":r.sourceType==="profilebadge"?"Profile badge":r.sourceType==="sra"?"Selector":"Item"} · ${r.amount??`×${r.quantity.toLocaleString("en")}`}`}</p>{r.scope==="potentialCompletionRewards"&&<small className="text-slate-400">Possible outcome; not guaranteed</small>}</div>
    </li>)}</ul></section>)}</div>
    {outcomes.length>0&&<details className="mt-4 text-xs text-slate-400"><summary>Other recorded outcomes</summary><ul>{outcomes.map(r=><li key={r.key}>{questRewardScope(r.scope)} · {r.name}<details><summary>Source data</summary>{r.sourceType}/{r.token} · {r.amount}</details></li>)}</ul></details>}
  </section>;
}
