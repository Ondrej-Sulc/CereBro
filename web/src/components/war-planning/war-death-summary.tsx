"use client";

import { Fragment, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, PlayCircle, Skull, X } from "lucide-react";
import type { BattlegroupDeathSummary, WarDeathSummary } from "@/lib/war-death-summary";
import { cn } from "../../lib/utils";

export const recordedDeathsLabel = (deaths: number) => `${deaths} recorded ${deaths === 1 ? "death" : "deaths"}`;
export const warLabel = (war: WarDeathSummary) => war.warNumber ? `War ${war.warNumber}` : "Off-season";
const focusStyle = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400";
const linkStyle = `inline-flex min-h-9 items-center gap-1 rounded text-xs text-sky-400 hover:underline ${focusStyle}`;

/** One disclosure per player. Every recorded fight is visible after that single step. */
export function BattlegroupDeathBreakdown({ warId, summary, onSelectNode }: {
  warId: string;
  summary: BattlegroupDeathSummary;
  onSelectNode?: (nodeNumber: number) => void;
}) {
  if (summary.players.length === 0) {
    return <p className="py-6 text-sm text-slate-400">No recorded deaths in this battlegroup.</p>;
  }

  return (
    <div className="divide-y divide-slate-800">
      {summary.players.map(player => {
        const fightCount = player.nodes.reduce((sum, node) => sum + node.fights.length, 0);
        return (
          <details key={player.playerId ?? "unassigned"} className="group min-w-0">
            <summary className={cn("flex cursor-pointer list-none items-center gap-3 rounded px-2 py-3 hover:bg-slate-800/40 [&::-webkit-details-marker]:hidden", focusStyle)}>
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium text-slate-200 [overflow-wrap:anywhere]">{player.playerName}</span>
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
            <div className="min-w-0 pb-3 pl-2 pr-2 sm:pl-9">
              {player.playerId && <Link href={`/player/${player.playerId}`} className={linkStyle}>Player profile / combat history <ExternalLink aria-hidden="true" className="h-3 w-3" /></Link>}
              <ul className="divide-y divide-slate-800/70 rounded-lg bg-slate-950/60 px-3">
                {player.nodes.flatMap(node => node.fights.map((fight, index) => (
                  <li key={fight.id} className="min-w-0 py-3">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
                      <div>
                        {onSelectNode ? (
                          <button type="button" onClick={() => onSelectNode(node.nodeNumber)} aria-label={`Open node ${node.nodeNumber} in planner`} className={linkStyle}>Node {node.nodeNumber}</button>
                        ) : (
                          <Link href={`/planning/${warId}?bg=${summary.battlegroup}&node=${node.nodeNumber}`} aria-label={`Open node ${node.nodeNumber} in planner`} className={linkStyle}>Node {node.nodeNumber} <ExternalLink aria-hidden="true" className="h-3 w-3" /></Link>
                        )}
                        {node.fights.length > 1 && <span className="block text-[11px] text-slate-500">Fight {index + 1}/{node.fights.length}</span>}
                      </div>
                      <p className="min-w-0 pt-2 text-sm text-slate-300 [overflow-wrap:anywhere]">{fight.attackerName} <span className="text-slate-500">→</span> {fight.defenderName}</p>
                      <span className="pt-2 text-right font-mono text-sm tabular-nums text-red-300">
                        {fight.deaths}<span className="block font-sans text-[10px] text-slate-400">{fight.deaths === 1 ? "death" : "deaths"}</span>
                      </span>
                    </div>
                    {fight.notes && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-400 [overflow-wrap:anywhere]">{fight.notes}</p>}
                    {fight.videoId && <Link href={`/war-videos/${fight.videoId}`} className={linkStyle}><PlayCircle aria-hidden="true" className="h-3.5 w-3.5" /> Watch fight video</Link>}
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
    <section id="war-deaths" aria-labelledby={`${id}-title`} className="min-w-0 scroll-mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
      <div className="space-y-1 px-4 py-4 sm:px-5">
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-base font-semibold text-slate-100"><Skull aria-hidden="true" className="h-4 w-4 text-red-400" /> Recorded deaths by war</h2>
        <p id={`${id}-help`} className="text-xs leading-relaxed text-slate-400">Select a BG total for player and fight details. Zero means no recorded deaths; unassigned deaths are included.</p>
      </div>
      {summaries.length === 0 ? <p className="px-4 pb-5 text-sm text-slate-400">No wars recorded for this season.</p> : (
        <table className="w-full table-fixed text-sm" aria-describedby={`${id}-help`}>
          <caption className="sr-only">Recorded deaths for each war and battlegroup</caption>
          <colgroup>
            <col />
            {[1, 2, 3].map(bg => <col key={bg} className="w-11 sm:w-20" />)}
            <col className="w-12 sm:w-20" />
          </colgroup>
          <thead className="border-y border-slate-800 bg-slate-900/50 text-xs text-slate-400">
            <tr>
              <th scope="col" className="px-3 py-3 text-left font-medium sm:px-5">War / opponent</th>
              {[1, 2, 3].map(bg => (
                <th key={bg} scope="col" className="text-center font-medium">
                  <span className="inline-block border-b-2 pb-1" style={{ borderColor: bgColors?.[bg] ?? "#475569" }}>BG{bg}</span>
                </th>
              ))}
              <th scope="col" className="text-center font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(war => {
              const selectedBg = selection?.warId === war.warId ? war.battlegroups.find(bg => bg.battlegroup === selection.bg) : undefined;
              const detailId = `${id}-${war.warId}-detail`;
              return (
                <Fragment key={war.warId}>
                  <tr className={cn("border-b border-slate-800/70", selectedBg && "bg-slate-900/70")}>
                    <th scope="row" className="px-3 py-2 text-left font-normal sm:px-5">
                      <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                        <span className="text-xs text-slate-400 sm:w-16 sm:shrink-0">{warLabel(war)}</span>
                        <span className="min-w-0 text-sm font-medium text-slate-200 [overflow-wrap:anywhere]">{war.opponent}</span>
                      </span>
                    </th>
                    {[1, 2, 3].map(bgNumber => {
                      const bg = war.battlegroups.find(group => group.battlegroup === bgNumber);
                      const selected = selectedBg?.battlegroup === bgNumber;
                      return (
                        <td key={bgNumber} className="px-0 py-1 text-center">
                          <button
                            ref={selected ? selectedButton : undefined}
                            type="button"
                            aria-label={`${warLabel(war)} vs ${war.opponent}, BG${bgNumber}: ${recordedDeathsLabel(bg?.deaths ?? 0)}`}
                            aria-expanded={selected}
                            aria-controls={selected ? detailId : undefined}
                            onClick={() => setSelection(selected ? null : { warId: war.warId, bg: bgNumber })}
                            className={cn("min-h-11 w-full rounded-md font-mono tabular-nums transition-colors hover:bg-slate-800 sm:min-h-9", focusStyle, bg?.deaths ? "text-red-300" : "text-slate-400", selected && "bg-sky-950/60 ring-1 ring-inset ring-sky-500/70")}
                          >
                            {bg?.deaths ?? 0}
                          </button>
                        </td>
                      );
                    })}
                    <td className={cn("text-center font-mono font-semibold tabular-nums", war.deaths ? "text-slate-200" : "text-slate-500")}>{war.deaths}</td>
                  </tr>
                  {selectedBg && <tr><td colSpan={5} className="border-b border-slate-700 bg-slate-900/50 px-3 py-4 sm:px-5">
                    <div id={detailId} role="region" aria-label={`${warLabel(war)} vs ${war.opponent} · BG${selectedBg.battlegroup}`}>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-100 [overflow-wrap:anywhere]">{warLabel(war)} vs {war.opponent} · BG{selectedBg.battlegroup}</h3>
                          <p className="mt-1 text-xs text-slate-400">{recordedDeathsLabel(selectedBg.deaths)} · {selectedBg.players.length} {selectedBg.players.length === 1 ? "player" : "players"}</p>
                        </div>
                        <button
                          type="button"
                          aria-label="Close player breakdown"
                          onClick={() => { setSelection(null); selectedButton.current?.focus(); }}
                          className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white", focusStyle)}
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
          <tfoot className="bg-slate-900/50 text-xs text-slate-300">
            <tr>
              <th scope="row" className="px-3 py-3 text-left font-medium sm:px-5">Season total</th>
              {totals.map((total, index) => <td key={index} className="text-center font-mono tabular-nums">{total}</td>)}
              <td className="text-center font-mono font-semibold tabular-nums">{totals.reduce((sum, total) => sum + total, 0)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
