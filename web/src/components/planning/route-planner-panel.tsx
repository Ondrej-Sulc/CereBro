"use client";

import Image from "next/image";
import type { RefObject } from "react";
import { Check, ChevronRight, Crosshair, Swords, Target } from "lucide-react";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper";
import { cn } from "@/lib/utils";
import type { ChampionClass } from "@prisma/client";
import type { EncounterWithRelations, QuestTimelineProps } from "./types";

type RouteSection = NonNullable<QuestTimelineProps["quest"]["routeSections"]>[number];
type RoutePath = RouteSection["paths"][number];
type RouteSummaryItem = { sectionTitle: string; pathTitle: string };

export function TimelineColumnHeader() {
    return (
        <div className="relative mb-8">
            <div className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                {[0, 0.8, 1.6].map((delay, index) => (
                    <div
                        key={index}
                        className="absolute rounded-full border border-sky-400/50"
                        style={{
                            width: "18px",
                            height: "18px",
                            top: "50%",
                            left: "50%",
                            animation: `tlRing${index + 1} 2.4s ease-out infinite`,
                            animationDelay: `${delay}s`,
                        }}
                    />
                ))}
                {[-35, 0, 35].map((deg, index) => (
                    <div
                        key={`tick-${index}`}
                        className="absolute rounded-full bg-sky-400/50"
                        style={{
                            width: "1.5px",
                            height: "7px",
                            bottom: "50%",
                            left: "calc(50% - 0.75px)",
                            transformOrigin: "bottom center",
                            transform: `rotate(${deg}deg) translateY(12px)`,
                            animation: "tlTick 2.4s ease-in-out infinite",
                            animationDelay: `${index * 0.15}s`,
                        }}
                    />
                ))}
                <div
                    className="relative z-10 h-2.5 w-2.5 rounded-full bg-sky-400"
                    style={{ animation: "tlCorePulse 2.4s ease-in-out infinite" }}
                />
            </div>

            <div className="ml-5 flex items-center rounded-xl border border-slate-800/50 bg-slate-950/40 px-2 py-3 md:ml-10 md:px-4">
                <div className="flex flex-1 items-center justify-start gap-2 px-2 md:gap-3 md:px-6">
                    <div className="relative shrink-0">
                        <div className="absolute -inset-1 rounded-full bg-red-500/20 blur-sm" />
                        <Target className="relative h-3.5 w-3.5 text-red-500 md:h-4 md:w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="truncate bg-gradient-to-r from-red-400 to-orange-500 bg-clip-text text-[8px] font-black uppercase tracking-[0.2em] text-transparent md:text-[10px] md:tracking-[0.3em]">
                            Target
                        </span>
                        <div className="mt-0.5 h-0.5 w-8 rounded-full bg-gradient-to-r from-red-500/50 to-transparent md:w-12" />
                    </div>
                </div>

                <div className="flex w-12 shrink-0 items-center justify-center md:w-24">
                    <div className="relative flex h-6 w-6 items-center justify-center md:h-8 md:w-8">
                        <div className="absolute inset-0 rotate-45 rounded-sm border border-slate-800" />
                        <span className="relative z-10 text-[8px] font-black uppercase italic text-slate-600 md:text-[10px]">VS</span>
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-end gap-2 px-2 text-right md:gap-3 md:px-6">
                    <div className="flex flex-col items-end">
                        <span className="truncate bg-gradient-to-l from-sky-400 to-indigo-500 bg-clip-text text-[8px] font-black uppercase tracking-[0.2em] text-transparent md:text-[10px] md:tracking-[0.3em]">
                            Counter
                        </span>
                        <div className="mt-0.5 h-0.5 w-8 rounded-full bg-gradient-to-l from-sky-500/50 to-transparent md:w-12" />
                    </div>
                    <div className="relative shrink-0">
                        <div className="absolute -inset-1 rounded-full bg-sky-500/20 blur-sm" />
                        <Swords className="relative h-3.5 w-3.5 text-sky-500 md:h-4 md:w-4" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function RoutePathCard({
    sectionId,
    path,
    encounters,
    isSelected,
    compact,
    readOnly,
    setRouteCardRef,
    onRouteChoice,
    scrollToEncounter,
}: {
    sectionId: string;
    path: RoutePath;
    encounters: EncounterWithRelations[];
    isSelected: boolean;
    compact: boolean;
    readOnly: boolean;
    setRouteCardRef: (pathId: string, node: HTMLDivElement | null) => void;
    onRouteChoice: (sectionId: string, pathId: string) => void;
    scrollToEncounter: (encounterId: string) => void;
}) {
    const previewLimit = compact ? 6 : 5;
    const previewEncounters = encounters.slice(0, previewLimit);
    const hiddenCount = Math.max(0, encounters.length - previewEncounters.length);

    return (
        <div
            ref={(node) => setRouteCardRef(path.id, node)}
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-pressed={isSelected}
            onClick={() => onRouteChoice(sectionId, path.id)}
            onKeyDown={(event) => {
                if (readOnly) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onRouteChoice(sectionId, path.id);
                }
            }}
            className={cn(
                "relative min-w-0 rounded-lg border text-left backdrop-blur-sm transition-all group/path",
                compact ? cn("w-max max-w-[calc(100vw-5rem)] p-2", isSelected ? "opacity-100" : "opacity-70 hover:opacity-100") : "w-full p-2.5",
                isSelected
                    ? "border-cyan-400/70 bg-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.16),inset_0_0_18px_rgba(8,145,178,0.16)]"
                    : "border-slate-800 bg-slate-950/95 hover:border-slate-700 hover:bg-slate-900",
                readOnly ? "cursor-default" : "cursor-pointer"
            )}
        >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                    <div className={cn(
                        "flex shrink-0 items-center justify-center rounded-full border transition-colors",
                        compact ? "h-4 w-4" : "h-5 w-5",
                        isSelected ? "border-cyan-300 bg-cyan-400 text-slate-950" : "border-slate-700 bg-slate-950 text-slate-600 group-hover/path:text-slate-400"
                    )}>
                        {isSelected ? <Check className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} /> : <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </div>
                    <span className={cn(
                        "min-w-0 truncate font-black uppercase tracking-[0.08em]",
                        compact ? "text-[10px]" : "text-[11px]",
                        isSelected ? "text-cyan-100" : "text-slate-300"
                    )}>
                        {path.title}
                    </span>
                </div>
                <span className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                    isSelected ? "border-cyan-700/60 bg-cyan-950/60 text-cyan-200" : "border-slate-800 bg-slate-950/80 text-slate-600"
                )}>
                    {encounters.length > 0 ? encounters.length : "Choice"}
                </span>
            </div>

            <div className={cn("mt-2 flex items-center", compact ? "min-h-7" : "min-h-9")}>
                {previewEncounters.length > 0 ? (
                    <div className="flex min-w-0 items-center overflow-hidden pr-1">
                        {previewEncounters.map((encounter, encounterIndex) => (
                            <RouteEncounterPreview
                                key={encounter.id}
                                encounter={encounter}
                                encounterIndex={encounterIndex}
                                isSelected={isSelected}
                                compact={compact}
                                scrollToEncounter={scrollToEncounter}
                            />
                        ))}
                        {hiddenCount > 0 && (
                            <>
                                <div className={cn("h-px shrink-0", compact ? "w-2" : "w-3", isSelected ? "bg-cyan-600/80" : "bg-slate-800")} />
                                <div className={cn("relative flex shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-950 text-[10px] font-black text-slate-500", compact ? "h-8 w-8" : "h-9 w-9")}>
                                    +{hiddenCount}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        <ChevronRight className="h-3 w-3" />
                        <span>Unlocks later sections</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function RouteEncounterPreview({
    encounter,
    encounterIndex,
    isSelected,
    compact,
    scrollToEncounter,
}: {
    encounter: EncounterWithRelations;
    encounterIndex: number;
    isSelected: boolean;
    compact: boolean;
    scrollToEncounter: (encounterId: string) => void;
}) {
    const classColors = encounter.defender
        ? getChampionClassColors(encounter.defender.class as ChampionClass)
        : null;
    const difficultyClasses = encounter.difficulty === "HARD"
        ? "border-red-500/70 bg-red-950/50 shadow-red-950/50"
        : encounter.difficulty === "EASY"
            ? "border-emerald-500/60 bg-emerald-950/40 shadow-emerald-950/40"
            : encounter.difficulty === "NORMAL"
                ? "border-amber-500/60 bg-amber-950/40 shadow-amber-950/40"
                : "border-slate-700 bg-slate-950";
    const difficultyDot = encounter.difficulty === "HARD"
        ? "bg-red-400"
        : encounter.difficulty === "EASY"
            ? "bg-emerald-400"
            : encounter.difficulty === "NORMAL"
                ? "bg-amber-400"
                : "bg-slate-500";

    return (
        <div className="flex items-center">
            {encounterIndex > 0 && (
                <div className={cn(
                    "h-px shrink-0",
                    compact ? "w-2" : "w-3",
                    isSelected ? "bg-cyan-600/80" : "bg-slate-800"
                )} />
            )}
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    scrollToEncounter(encounter.id);
                }}
                className={cn(
                    "relative shrink-0 overflow-hidden rounded-md border shadow-sm transition-transform hover:-translate-y-0.5 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
                    compact ? "h-8 w-8" : "h-9 w-9",
                    classColors?.bg || "bg-slate-950",
                    difficultyClasses,
                    isSelected && "outline outline-1 outline-offset-1 outline-cyan-300/60",
                    classColors?.border && encounter.difficulty !== "HARD" && encounter.difficulty !== "EASY" && encounter.difficulty !== "NORMAL" ? classColors.border : null
                )}
                title={`Fight ${encounter.sequence}: ${encounter.defender?.name || "Unknown defender"} (${encounter.difficulty})`}
            >
                <div className="absolute inset-0 bg-slate-950/25" />
                {encounter.defender ? (
                    <Image
                        src={getChampionImageUrlOrPlaceholder(encounter.defender.images, "64")}
                        alt={encounter.defender.name}
                        fill
                        className="rounded-[5px] object-cover p-0.5"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-slate-600">?</div>
                )}
                <div className={cn("absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-slate-950", difficultyDot)} />
            </button>
        </div>
    );
}

export function RoutePlannerPanel({
    visibleRouteSections,
    routeFilteredEncounterCount,
    routeChoices,
    selectedRouteSummary,
    encountersByRoutePathId,
    routeMapRef,
    routeStartRef,
    routeEndRef,
    routeConnectorPaths,
    routeMapSize,
    readOnly,
    setRouteCardRef,
    onRouteChoice,
    scrollToEncounter,
}: {
    visibleRouteSections: RouteSection[];
    routeFilteredEncounterCount: number;
    routeChoices: Record<string, string>;
    selectedRouteSummary: RouteSummaryItem[];
    encountersByRoutePathId: Map<string, EncounterWithRelations[]>;
    routeMapRef: RefObject<HTMLDivElement | null>;
    routeStartRef: RefObject<HTMLDivElement | null>;
    routeEndRef: RefObject<HTMLDivElement | null>;
    routeConnectorPaths: string[];
    routeMapSize: { width: number; height: number };
    readOnly: boolean;
    setRouteCardRef: (pathId: string, node: HTMLDivElement | null) => void;
    onRouteChoice: (sectionId: string, pathId: string) => void;
    scrollToEncounter: (encounterId: string) => void;
}) {
    if (visibleRouteSections.length === 0) return null;

    return (
        <div className="-mt-2 mb-4 pl-6 md:pl-10">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 bg-slate-900/40 px-3 py-3 md:px-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="hidden h-8 w-8 items-center justify-center rounded-lg border border-sky-900/60 bg-sky-950/30 text-sky-400 sm:flex">
                            <Crosshair className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">Route Planner</h3>
                            <p className="mt-0.5 truncate text-[11px] text-slate-600">{routeFilteredEncounterCount} fights on selected route</p>
                        </div>
                    </div>
                    <div className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:flex">
                        <span>{visibleRouteSections.length}</span>
                        <span>{visibleRouteSections.length === 1 ? "section" : "sections"}</span>
                    </div>
                </div>

                {selectedRouteSummary.length > 0 && (
                    <div className="overflow-x-auto border-b border-slate-800/70 bg-slate-950/50 px-3 py-2 md:px-4">
                        <div className="flex min-w-max items-center gap-1.5">
                            {selectedRouteSummary.map((item, index) => (
                                <div key={`${item.sectionTitle}-${index}`} className="flex items-center gap-1.5">
                                    {index > 0 && <ChevronRight className="h-3 w-3 text-slate-700" />}
                                    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1">
                                        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-300">{item.pathTitle}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto px-3 py-4 md:px-4">
                    <div
                        ref={routeMapRef}
                        className="relative flex min-w-max items-center gap-9 pr-2"
                    >
                        <svg
                            className="pointer-events-none absolute inset-0 z-0"
                            width={routeMapSize.width}
                            height={routeMapSize.height}
                            viewBox={`0 0 ${routeMapSize.width} ${routeMapSize.height}`}
                            preserveAspectRatio="none"
                        >
                            {routeConnectorPaths.map((path, index) => (
                                <g key={index}>
                                    <path d={path} fill="none" stroke="rgb(8 47 73)" strokeWidth="7" strokeLinecap="round" opacity="0.65" />
                                    <path d={path} fill="none" stroke="rgb(34 211 238)" strokeWidth="2.5" strokeLinecap="round" opacity="0.86" />
                                    <path d={path} fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.24" />
                                    <path
                                        d={path}
                                        fill="none"
                                        stroke="rgb(34 211 238)"
                                        strokeWidth="8"
                                        strokeLinecap="round"
                                        strokeDasharray="0.5 92"
                                        opacity="0"
                                        style={{
                                            filter: "blur(5px)",
                                            animation: "routeHalo 3.1s ease-in-out infinite",
                                            animationDelay: `${index * 0.22}s`,
                                        }}
                                    />
                                    <path
                                        d={path}
                                        fill="none"
                                        stroke="rgb(236 254 255)"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        strokeDasharray="0.5 92"
                                        opacity="0"
                                        style={{
                                            animation: "routePulse 3.1s ease-in-out infinite",
                                            animationDelay: `${index * 0.22}s`,
                                        }}
                                    />
                                </g>
                            ))}
                        </svg>

                        <div
                            ref={routeStartRef}
                            className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-500/60 bg-cyan-950/40 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                        >
                            <Crosshair className="h-5 w-5" />
                        </div>

                        {visibleRouteSections.map((section) => {
                            const selectedPathId = routeChoices[section.id] || section.paths[0]?.id;
                            const selectedPath = section.paths.find(path => path.id === selectedPathId) || section.paths[0];

                            return (
                                <div
                                    key={section.id}
                                    className="relative z-10 flex shrink-0 flex-col justify-center gap-2"
                                >
                                    {section.paths.map(path => (
                                        <RoutePathCard
                                            key={path.id}
                                            sectionId={section.id}
                                            path={path}
                                            encounters={encountersByRoutePathId.get(path.id) || []}
                                            isSelected={path.id === selectedPath?.id}
                                            compact={true}
                                            readOnly={readOnly}
                                            setRouteCardRef={setRouteCardRef}
                                            onRouteChoice={onRouteChoice}
                                            scrollToEncounter={scrollToEncounter}
                                        />
                                    ))}
                                </div>
                            );
                        })}

                        <div
                            ref={routeEndRef}
                            className="relative z-10 flex h-12 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"
                        >
                            End
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
