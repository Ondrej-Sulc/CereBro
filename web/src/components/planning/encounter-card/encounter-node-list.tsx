"use client";

import { ChevronDown, ChevronUp, Info, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EncounterNodeWithRelations } from "../types";

export function EncounterNodeList({
    nodes,
    isCollapsed,
    setIsCollapsed,
}: {
    nodes: EncounterNodeWithRelations[];
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
}) {
    if (nodes.length === 0) return null;

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="-mx-2 -my-1 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-sky-950/30 group/nodes-toggle"
            >
                <div className="h-6 w-1 shrink-0 rounded-full bg-sky-500 transition-colors group-hover/nodes-toggle:bg-sky-400" />
                <h4 className="flex-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-400 transition-colors group-hover/nodes-toggle:text-sky-300">Encounter Nodes</h4>
                {isCollapsed ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sky-600 transition-colors group-hover/nodes-toggle:text-sky-300" />
                ) : (
                    <ChevronUp className="h-3.5 w-3.5 shrink-0 text-sky-600 transition-colors group-hover/nodes-toggle:text-sky-300" />
                )}
            </button>
            {isCollapsed ? (
                <div className="flex flex-wrap gap-1.5">
                    {nodes.map((node) => (
                        <Badge
                            key={node.id}
                            variant="secondary"
                            className={cn(
                                "gap-1 py-0.5 text-[11px] font-medium",
                                node.isHighlighted
                                    ? "border-amber-600/60 bg-amber-950/60 text-amber-200"
                                    : "border-sky-900/50 bg-sky-950/40 text-sky-300"
                            )}
                        >
                            {node.isHighlighted && <Star className="h-3 w-3 shrink-0 fill-current" />}
                            {node.nodeModifier.name}
                        </Badge>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {nodes.map((node) => (
                        <div
                            key={node.id}
                            className={cn(
                                "rounded-lg border p-3 transition-all group/node",
                                node.isHighlighted
                                    ? "border-amber-600/50 bg-amber-950/20 hover:border-amber-400/60 hover:bg-amber-950/30"
                                    : "border-slate-800/80 bg-slate-950/80 hover:border-sky-800/50 hover:bg-slate-900/50"
                            )}
                        >
                            <div className="mb-1 flex items-center gap-2">
                                <div className={cn(
                                    "shrink-0 rounded p-1",
                                    node.isHighlighted ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/10 text-sky-500"
                                )}>
                                    {node.isHighlighted ? <Star className="h-3.5 w-3.5 fill-current" /> : <Info className="h-3.5 w-3.5" />}
                                </div>
                                <span className="text-sm font-bold text-slate-100">{node.nodeModifier.name}</span>
                            </div>
                            <span className="block pl-8 pr-2 text-xs leading-normal text-slate-400">{node.nodeModifier.description}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
