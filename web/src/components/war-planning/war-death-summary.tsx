"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ExternalLink, PlayCircle, Skull } from "lucide-react";
import type { WarDeathSummary } from "@/lib/war-death-summary";

interface WarDeathSummaryPanelProps {
  summaries: WarDeathSummary[];
  initialWarId?: string;
  initialBattlegroup?: number;
  /** The live planner has loaded only this BG, so other BGs must not show false zeroes. */
  battlegroup?: number;
  onSelectNode?: (nodeNumber: number) => void;
}

export function WarDeathSummaryPanel({ summaries, initialWarId, initialBattlegroup, battlegroup, onSelectNode }: WarDeathSummaryPanelProps) {
  const id = useId();
  const [warId, setWarId] = useState(summaries.some(war => war.warId === initialWarId) ? initialWarId! : "all");
  const [selectedBg, setSelectedBg] = useState(initialBattlegroup && [1, 2, 3].includes(initialBattlegroup) ? String(initialBattlegroup) : "all");
  const visibleWars = summaries.filter(war => warId === "all" || war.warId === warId);
  const bgFilter = battlegroup ? String(battlegroup) : selectedBg;

  return (
    <section id="war-deaths" aria-labelledby={`${id}-title`} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-lg font-bold text-slate-100"><Skull className="h-5 w-5 text-red-400" /> Recorded deaths by war</h2>
          <p className="text-sm text-slate-400">Expand a battlegroup, player and node to see recorded deaths.</p>
          <p className="text-xs text-slate-500">Zero means no recorded deaths. Unassigned deaths remain included.</p>
        </div>
        {!battlegroup && (
          <div className="flex flex-wrap gap-3 text-sm">
            <label htmlFor={`${id}-war`} className="space-y-1 text-slate-400">War
              <select id={`${id}-war`} value={warId} onChange={event => setWarId(event.target.value)} className="block h-9 max-w-64 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-100">
                <option value="all">All wars</option>
                {summaries.map(war => <option key={war.warId} value={war.warId}>{war.warNumber ? `War ${war.warNumber}` : "Off-season"} · {war.opponent}</option>)}
              </select>
            </label>
            <label htmlFor={`${id}-bg`} className="space-y-1 text-slate-400">Battlegroup
              <select id={`${id}-bg`} value={selectedBg} onChange={event => setSelectedBg(event.target.value)} className="block h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-100">
                <option value="all">All BGs</option>
                {[1, 2, 3].map(bg => <option key={bg} value={bg}>BG{bg}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
      {visibleWars.length === 0 && <p className="py-4 text-sm text-slate-400">No wars recorded for this season.</p>}
      {visibleWars.map(war => (
        <article key={war.warId} className="space-y-3 border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-slate-200">{war.warNumber ? `War ${war.warNumber}` : "Off-season"} <span className="font-normal text-slate-400">vs {war.opponent}</span></h3>
            {bgFilter === "all" && <span className="text-sm text-red-400">{war.deaths} recorded deaths</span>}
          </div>
          <div className="space-y-2">
            {war.battlegroups.filter(bg => bgFilter === "all" || String(bg.battlegroup) === bgFilter).map(bg => (
              <details key={bg.battlegroup} open={bgFilter !== "all" || undefined} className="rounded-lg border border-slate-800 bg-slate-900/40">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-200">BG{bg.battlegroup} <span className="ml-3 font-mono text-red-400">{bg.deaths} deaths</span></summary>
                <div className="space-y-2 border-t border-slate-800 p-3">
                  {bg.players.length === 0 && <p className="text-sm text-slate-500">No recorded deaths in this battlegroup.</p>}
                  {bg.players.map(player => (
                    <details key={player.playerId ?? "unassigned"} className="rounded-md border border-slate-800">
                      <summary className="cursor-pointer px-3 py-2 text-sm text-slate-200">{player.playerName} <span className="ml-2 font-mono text-red-400">{player.deaths} deaths</span></summary>
                      <div className="space-y-2 px-3 pb-3">
                        {player.playerId && <Link href={`/player/${player.playerId}`} className="text-xs text-sky-400 hover:underline">Player profile / combat history</Link>}
                        {player.nodes.map(node => (
                          <details key={node.nodeNumber} className="rounded-md bg-slate-950/60">
                            <summary className="cursor-pointer px-3 py-2 text-sm text-slate-300">Node {node.nodeNumber} <span className="ml-2 font-mono text-red-400">{node.deaths} deaths</span></summary>
                            <div className="space-y-3 px-3 pb-3">
                              {node.fights.map((fight, index) => (
                                <div key={fight.id} className="space-y-1 border-l-2 border-red-900/60 pl-3 text-sm">
                                  <p className="text-slate-300">Fight {index + 1}: {fight.attackerName} → {fight.defenderName} <span className="font-mono text-red-400">· {fight.deaths} deaths</span></p>
                                  {fight.notes && <p className="whitespace-pre-wrap break-words text-xs text-slate-400">{fight.notes}</p>}
                                  {fight.videoId && <Link href={`/war-videos/${fight.videoId}`} className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"><PlayCircle className="h-3 w-3" /> Watch fight video</Link>}
                                </div>
                              ))}
                              {onSelectNode ? (
                                <button type="button" onClick={() => onSelectNode(node.nodeNumber)} className="text-xs text-sky-400 hover:underline">Open node {node.nodeNumber} in planner</button>
                              ) : (
                                <Link href={`/planning/${war.warId}?bg=${bg.battlegroup}&node=${node.nodeNumber}`} className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"><ExternalLink className="h-3 w-3" /> Open node in planner</Link>
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
