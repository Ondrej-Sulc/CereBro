"use client";

import { Fragment, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, PlayCircle, Skull, Swords, X } from "lucide-react";
import type { BattlegroupDeathSummary, RecordedDeathChampion, WarDeathSummary } from "@/lib/war-death-summary";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "../../lib/utils";

export const recordedDeathsLabel = (deaths: number) => `${deaths} recorded ${deaths === 1 ? "death" : "deaths"}`;
export const warLabel = (war: WarDeathSummary) => war.warNumber ? `War ${war.warNumber}` : "Off-season";
const focusStyle = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400";
const linkStyle = `inline-flex min-h-11 items-center gap-1.5 rounded text-xs text-sky-400 hover:underline sm:min-h-9 ${focusStyle}`;

function FightChampion({ name, champion, role }: { name: string; champion: RecordedDeathChampion; role: "Attacker" | "Defender" }) {
  const colors = getChampionClassColors(champion.class ?? undefined);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className={cn("h-10 w-10 border bg-slate-900", colors.bg)} style={{ borderColor: champion.class ? colors.color : "#475569" }}>
        {champion.imageUrl && <AvatarImage src={champion.imageUrl} alt="" />}
        <AvatarFallback className="bg-slate-800 text-xs font-bold text-slate-300">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{role}</span>
        <span className="block text-sm font-semibold leading-snug [overflow-wrap:anywhere]" style={{ color: champion.class ? `color-mix(in srgb, ${colors.color} 60%, #e2e8f0)` : "#e2e8f0" }}>{name}</span>
      </div>
    </div>
  );
}

/** One disclosure per player. Every recorded fight is visible after that single step. */
export function BattlegroupDeathBreakdown({ warId, summary, onSelectNode }: {
  warId: string;
  summary: BattlegroupDeathSummary;
  onSelectNode?: (nodeNumber: number) => void;
}) {
  const disclosureGroup = useId();
  if (summary.players.length === 0) {
    return <p className="py-6 text-sm text-slate-400">No recorded deaths in this battlegroup.</p>;
  }

  return (
    <div className="divide-y divide-slate-800/70">
      {summary.players.map(player => {
        const fightCount = player.nodes.reduce((sum, node) => sum + node.fights.length, 0);
        return (
          <details key={player.playerId ?? "unassigned"} name={disclosureGroup} className="group min-w-0">
            <summary className={cn("flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-800/40 group-open:bg-slate-800/30 [&::-webkit-details-marker]:hidden", focusStyle)}>
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-semibold text-slate-200 [overflow-wrap:anywhere]">{player.playerName}</span>
                <span className="mt-1 block text-xs text-slate-400 [overflow-wrap:anywhere]">
                  {player.nodes.length === 1 ? "Node " : "Nodes "}{player.nodes.map(node => node.nodeNumber).join(", ")}
                  {" · "}{fightCount} recorded {fightCount === 1 ? "fight" : "fights"}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-sm font-semibold tabular-nums text-red-300">{player.deaths}</span>
                <span className="text-xs text-slate-500">{player.deaths === 1 ? "death" : "deaths"}</span>
              </span>
            </summary>
            <div className="min-w-0 px-1 pb-4 sm:pl-9 sm:pr-2">
              {player.playerId && <Link href={`/player/${player.playerId}`} className={linkStyle}>Player profile / combat history <ExternalLink aria-hidden="true" className="h-3 w-3" /></Link>}
              <ul className="space-y-2">
                {player.nodes.flatMap(node => node.fights.map((fight, index) => (
                  <li key={fight.id} className="min-w-0 rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 pb-3">
                    <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-800/60 pb-1 pt-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3">
                        {onSelectNode ? (
                          <button type="button" onClick={() => onSelectNode(node.nodeNumber)} aria-label={`Open node ${node.nodeNumber} in planner`} className={linkStyle}>Node {node.nodeNumber}</button>
                        ) : (
                          <Link href={`/planning/${warId}?bg=${summary.battlegroup}&node=${node.nodeNumber}`} aria-label={`Open node ${node.nodeNumber} in planner`} className={linkStyle}>Node {node.nodeNumber} <ExternalLink aria-hidden="true" className="h-3 w-3" /></Link>
                        )}
                        {node.fights.length > 1 && <span className="text-[11px] text-slate-500">Fight {index + 1}/{node.fights.length}</span>}
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded border border-red-400/15 bg-red-400/5 px-2 py-1 text-red-300">
                        <Skull aria-hidden="true" className="h-3 w-3" /><span className="font-mono text-sm font-semibold tabular-nums">{fight.deaths}</span><span className="text-[10px]">{fight.deaths === 1 ? "death" : "deaths"}</span>
                      </span>
                    </div>
                    <div className="grid min-w-0 gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                      <FightChampion name={fight.attackerName} champion={fight.attacker} role="Attacker" />
                      <Swords aria-hidden="true" className="hidden h-4 w-4 text-slate-600 sm:block" />
                      <FightChampion name={fight.defenderName} champion={fight.defender} role="Defender" />
                    </div>
                    {(fight.notes || fight.videoId || fight.videoIds?.length) && <div className="min-w-0 space-y-1 border-t border-slate-800/60 pt-2">
                      {fight.notes && <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-400 [overflow-wrap:anywhere]">{fight.notes}</p>}
                      {(fight.videoIds || (fight.videoId ? [fight.videoId] : [])).map((id, index, videos) => <Link key={id} href={`/war-videos/${id}`} className={linkStyle}><PlayCircle aria-hidden="true" className="h-3.5 w-3.5" /> {videos.length > 1 ? `Watch video ${index + 1}` : 'Watch fight video'}</Link>)}
                    </div>}
                  </li>
                )))}
              </ul>
            </div>
          </details>
        );
      })}
    </div>
  );
}

interface WarDeathSummaryPanelProps {
  summaries: WarDeathSummary[];
  initialWarId?: string;
  initialBattlegroup?: number;
  bgColors?: Record<number, string>;
}

/** Season comparison stays visible; only the selected war/BG adds a player breakdown. */
export function WarDeathSummaryPanel({ summaries, initialWarId, initialBattlegroup, bgColors }: WarDeathSummaryPanelProps) {
  const id = useId();
  const [selection, setSelection] = useState<{ warId: string; bg: number } | null>(() =>
    summaries.some(war => war.warId === initialWarId) && initialBattlegroup && [1, 2, 3].includes(initialBattlegroup)
      ? { warId: initialWarId!, bg: initialBattlegroup } : null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const totals = [1, 2, 3].map(bg => summaries.reduce((sum, war) => sum + (war.battlegroups.find(group => group.battlegroup === bg)?.deaths ?? 0), 0));

  return (
    <section id="war-deaths" aria-labelledby={`${id}-title`} className="min-w-0 scroll-mt-6">
      <Card className="min-w-0 overflow-hidden border-slate-800/60 bg-slate-950/40 shadow-xl">
        <CardHeader className="space-y-2 border-b border-slate-800/60 bg-slate-900/40 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-xl font-black uppercase italic tracking-tighter text-slate-200 sm:text-2xl"><h2 id={`${id}-title`} className="flex items-center gap-2.5"><Skull aria-hidden="true" className="h-5 w-5 text-red-400" /> Recorded deaths</h2></CardTitle>
            <span className="rounded border border-slate-800 bg-slate-950/50 px-2 py-0.5 text-[10px] font-black uppercase text-slate-400">{summaries.length} wars</span>
          </div>
          <p id={`${id}-help`} className="text-xs leading-relaxed text-slate-400">Select a BG for fight details. Zero means no recorded deaths; unassigned deaths are included.</p>
        </CardHeader>
        {summaries.length === 0 ? <p className="px-4 py-5 text-sm text-slate-400 sm:px-6">No wars recorded for this season.</p> : (
          <table className="w-full table-fixed text-sm" aria-describedby={`${id}-help`}>
            <caption className="sr-only">Recorded deaths for each war and battlegroup</caption>
            <colgroup>
              <col />
              {[1, 2, 3].map(bg => <col key={bg} className="w-[52px] sm:w-24" />)}
              <col className="w-12 sm:w-24" />
            </colgroup>
            <thead className="border-b border-slate-800/80 bg-slate-950/30 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-3 py-3 text-left sm:px-6">War / opponent</th>
                {[1, 2, 3].map(bg => (
                  <th key={bg} scope="col" className="text-center">
                    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: bgColors?.[bg] ?? "#64748b" }} />BG{bg}</span>
                  </th>
                ))}
                <th scope="col" className="border-l border-slate-800/60 bg-slate-900/40 text-center text-slate-300">Total</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(war => {
                const selectedBg = selection?.warId === war.warId ? war.battlegroups.find(bg => bg.battlegroup === selection.bg) : undefined;
                const detailId = `${id}-${war.warId}-detail`;
                return (
                  <Fragment key={war.warId}>
                    <tr className={cn("border-b border-slate-800/60 transition-colors hover:bg-slate-900/30", selectedBg && "bg-slate-900/80")}>
                      <th scope="row" className="px-3 py-2.5 text-left font-normal sm:px-6">
                        <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:w-16 sm:shrink-0">{warLabel(war)}</span>
                          <span className="min-w-0 text-xs font-semibold leading-snug text-slate-200 [overflow-wrap:anywhere] sm:text-sm">{war.opponent}</span>
                        </span>
                      </th>
                      {[1, 2, 3].map(bgNumber => {
                        const bg = war.battlegroups.find(group => group.battlegroup === bgNumber);
                        const selected = selectedBg?.battlegroup === bgNumber;
                        return (
                          <td key={bgNumber} className="px-1 py-1.5 text-center">
                            <button
                              ref={selected ? selectedButton : undefined}
                              type="button"
                              aria-label={`${warLabel(war)} vs ${war.opponent}, BG${bgNumber}: ${recordedDeathsLabel(bg?.deaths ?? 0)}`}
                              aria-expanded={selected}
                              aria-controls={selected ? detailId : undefined}
                              onClick={() => setSelection(selected ? null : { warId: war.warId, bg: bgNumber })}
                              style={selected ? { borderColor: bgColors?.[bgNumber] ?? "#38bdf8", backgroundColor: `color-mix(in srgb, ${bgColors?.[bgNumber] ?? "#38bdf8"} 12%, #0f172a)` } : undefined}
                              className={cn("inline-flex min-h-11 min-w-11 w-full items-center justify-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/80 font-mono text-xs font-semibold tabular-nums shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-800 sm:min-h-9 sm:text-sm", focusStyle, bg?.deaths ? "text-slate-200" : "text-slate-400", selected && "text-white")}
                            >
                              {bg?.deaths ?? 0}
                              <ChevronDown aria-hidden="true" className={cn("h-3 w-3 shrink-0 text-slate-500 transition-transform", selected && "rotate-180 text-slate-200")} />
                            </button>
                          </td>
                        );
                      })}
                      <td className={cn("border-l border-slate-800/60 bg-slate-900/30 text-center font-mono font-bold tabular-nums", war.deaths ? "text-slate-100" : "text-slate-500")}>{war.deaths}</td>
                    </tr>
                    {selectedBg && <tr><td colSpan={5} className="border-b border-slate-700 bg-slate-900/40 p-2 sm:p-4">
                      <div id={detailId} role="region" aria-label={`${warLabel(war)} vs ${war.opponent} · BG${selectedBg.battlegroup}`} className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/40 px-2 pb-1 sm:px-4" style={{ borderTopColor: bgColors?.[selectedBg.battlegroup] ?? "#475569" }}>
                        <div className="mb-1 flex items-start justify-between gap-3 border-b border-slate-800/70 py-3">
                          <div className="min-w-0">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-widest" style={{ color: bgColors?.[selectedBg.battlegroup] ?? "#94a3b8" }}>BG{selectedBg.battlegroup} · Fight breakdown</p>
                            <h3 className="text-sm font-semibold text-slate-100 [overflow-wrap:anywhere]">{warLabel(war)} vs {war.opponent}</h3>
                            <p className="mt-1 text-xs text-slate-400">{recordedDeathsLabel(selectedBg.deaths)} · {selectedBg.players.length} {selectedBg.players.length === 1 ? "player" : "players"}</p>
                          </div>
                          <button
                            type="button"
                            aria-label="Close player breakdown"
                            onClick={() => { setSelection(null); selectedButton.current?.focus(); }}
                            className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white sm:h-9 sm:w-9", focusStyle)}
                          >
                            <X aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                        <BattlegroupDeathBreakdown key={`${war.warId}-${selectedBg.battlegroup}`} warId={war.warId} summary={selectedBg} />
                      </div>
                    </td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-700/60 bg-slate-900/60 text-xs text-slate-300">
              <tr>
                <th scope="row" className="px-3 py-4 text-left text-[10px] font-black uppercase tracking-wide sm:px-6">Season total</th>
                {totals.map((total, index) => <td key={index} className="text-center font-mono tabular-nums">{total}</td>)}
                <td className="border-l border-slate-800/60 bg-slate-800/30 text-center font-mono text-sm font-bold tabular-nums text-slate-100">{totals.reduce((sum, total) => sum + total, 0)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>
    </section>
  );
}
