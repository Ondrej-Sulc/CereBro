"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, Flag, Lock, Map, Route, Star, Tag, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestTimelineProps } from "./types";

type Quest = QuestTimelineProps["quest"];
type Objective = Quest["objectives"][number];

type QuestObjectiveSelectorProps = {
    questId: string;
    baseQuest: Quest;
    objectives: Objective[];
    activeObjective: Objective | null | undefined;
};

function formatStarRestriction(minStarLevel?: number | null, maxStarLevel?: number | null) {
    if (minStarLevel && maxStarLevel) {
        return minStarLevel === maxStarLevel ? `${minStarLevel}★` : `${minStarLevel}-${maxStarLevel}★`;
    }

    if (minStarLevel) return `${minStarLevel}★+`;
    if (maxStarLevel) return `Up to ${maxStarLevel}★`;
    return null;
}

function classIconPath(championClass: string) {
    return `/assets/icons/${championClass.charAt(0).toUpperCase()}${championClass.slice(1).toLowerCase()}.png`;
}

function ObjectiveBadge({
    icon,
    children,
    className,
}: {
    icon?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-[10px] font-black uppercase leading-none tracking-[0.1em] text-slate-300",
                className
            )}
        >
            {icon}
            <span className="truncate">{children}</span>
        </span>
    );
}

function ClassRestrictionBadge({ classes }: { classes: string[] }) {
    if (classes.length === 0) return null;

    return (
        <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full border border-sky-800/50 bg-sky-950/30 px-2 py-1">
            {classes.map((championClass) => (
                <span key={championClass} className="relative h-4 w-4 shrink-0" title={championClass}>
                    <Image
                        src={classIconPath(championClass)}
                        alt={championClass}
                        fill
                        sizes="16px"
                        className="object-contain"
                    />
                </span>
            ))}
        </span>
    );
}

function RestrictionBadges({
    minStarLevel,
    maxStarLevel,
    requiredClasses,
    requiredTags,
    requiredTagMode,
    teamLimit,
}: {
    minStarLevel?: number | null;
    maxStarLevel?: number | null;
    requiredClasses?: string[];
    requiredTags?: Array<{ id: number | string; name: string }>;
    requiredTagMode?: string | null;
    teamLimit?: number | null;
}) {
    const starRestriction = formatStarRestriction(minStarLevel, maxStarLevel);
    const visibleTags = requiredTags?.slice(0, 2) ?? [];
    const hiddenTagCount = Math.max(0, (requiredTags?.length ?? 0) - visibleTags.length);
    const hasRestrictions = Boolean(
        starRestriction ||
        requiredClasses?.length ||
        requiredTags?.length ||
        teamLimit
    );

    if (!hasRestrictions) {
        return (
            <ObjectiveBadge className="border-slate-800 bg-slate-900/60 text-slate-500">
                No extra limits
            </ObjectiveBadge>
        );
    }

    return (
        <>
            {starRestriction && (
                <ObjectiveBadge
                    icon={<Star className="h-3 w-3 fill-amber-300 text-amber-300" />}
                    className="border-amber-700/50 bg-amber-950/30 text-amber-200"
                >
                    {starRestriction}
                </ObjectiveBadge>
            )}

            <ClassRestrictionBadge classes={requiredClasses ?? []} />

            {teamLimit && (
                <ObjectiveBadge
                    icon={<Users className="h-3 w-3 text-cyan-300" />}
                    className="border-cyan-800/50 bg-cyan-950/25 text-cyan-200"
                >
                    Team {teamLimit}
                </ObjectiveBadge>
            )}

            {visibleTags.map((tag) => (
                <ObjectiveBadge
                    key={tag.id}
                    icon={<Tag className="h-3 w-3 text-slate-500" />}
                    className="border-slate-700/70 bg-slate-900/80 text-slate-300"
                >
                    {tag.name}
                </ObjectiveBadge>
            ))}

            {requiredTagMode === "ANY" && visibleTags.length > 1 && (
                <ObjectiveBadge className="border-sky-800/50 bg-sky-950/30 text-sky-200">
                    Any tag
                </ObjectiveBadge>
            )}

            {hiddenTagCount > 0 && (
                <ObjectiveBadge className="border-slate-800 bg-slate-900/70 text-slate-500">
                    +{hiddenTagCount} tags
                </ObjectiveBadge>
            )}
        </>
    );
}

function ActiveMarker({ active }: { active: boolean }) {
    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-black uppercase leading-none tracking-[0.16em]",
                active
                    ? "border-cyan-600/70 bg-cyan-950/50 text-cyan-100"
                    : "border-slate-800 bg-slate-950/70 text-slate-500 group-hover/objective:border-slate-700 group-hover/objective:text-slate-300"
            )}
        >
            {active && <CheckCircle2 className="h-3 w-3" />}
            {active ? "Active" : "Switch"}
        </div>
    );
}

function BaseQuestCard({ quest, active }: { quest: Quest; active: boolean }) {
    return (
        <Link
            href={`/planning/quests/${quest.id}`}
            aria-current={active ? "page" : undefined}
            className={cn(
                "group/objective flex min-h-[170px] min-w-[260px] snap-start flex-col rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 sm:min-w-0",
                active
                    ? "border-cyan-500/70 bg-cyan-950/25 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                    : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/80"
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400/80">Default</div>
                    <h3 className="mt-1 truncate text-sm font-black uppercase tracking-[0.08em] text-white">Base Quest</h3>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">Standard quest plan</p>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-900/60 bg-cyan-950/30 text-cyan-300">
                    <Target className="h-4 w-4" />
                </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
                <RestrictionBadges
                    minStarLevel={quest.minStarLevel}
                    maxStarLevel={quest.maxStarLevel}
                    requiredClasses={quest.requiredClasses}
                    requiredTags={quest.requiredTags}
                    teamLimit={quest.teamLimit}
                />
            </div>

            <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                <div className="min-w-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                    All route choices available
                </div>
                <ActiveMarker active={active} />
            </div>
        </Link>
    );
}

function ObjectiveCard({
    questId,
    objective,
    active,
}: {
    questId: string;
    objective: Objective;
    active: boolean;
}) {
    const title = objective.shortTitle || objective.title;
    const showFullTitle = Boolean(objective.shortTitle && objective.shortTitle !== objective.title);
    const lockedRouteCount = objective.routeChoices.filter((choice) => choice.isLocked).length;
    const routeDefaultCount = objective.routeChoices.length;
    const routeGuideCount = objective.routeRecommendations.length;

    return (
        <Link
            href={`/planning/quests/${questId}?objective=${encodeURIComponent(objective.slug)}`}
            aria-current={active ? "page" : undefined}
            className={cn(
                "group/objective flex min-h-[170px] min-w-[260px] snap-start flex-col rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 sm:min-w-0",
                active
                    ? "border-amber-500/70 bg-amber-950/20 shadow-[0_0_24px_rgba(245,158,11,0.12)]"
                    : "border-slate-800 bg-slate-950/70 hover:border-amber-900/70 hover:bg-slate-900/80"
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400/80">
                        Objective #{objective.order}
                    </div>
                    <h3 className="mt-1 truncate text-sm font-black uppercase tracking-[0.08em] text-white">{title}</h3>
                    {showFullTitle && (
                        <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{objective.title}</p>
                    )}
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-900/60 bg-amber-950/30 text-amber-300">
                    <Target className="h-4 w-4" />
                </div>
            </div>

            {objective.description && (
                <p
                    className="mt-2 text-[11px] font-medium leading-4 text-slate-500"
                    style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {objective.description}
                </p>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
                <RestrictionBadges
                    minStarLevel={objective.minStarLevel}
                    maxStarLevel={objective.maxStarLevel}
                    requiredClasses={objective.requiredClasses}
                    requiredTags={objective.requiredTags}
                    requiredTagMode={objective.requiredTagMode}
                    teamLimit={objective.teamLimitOverride}
                />
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
                {objective.endpointEncounter && (
                    <ObjectiveBadge
                        icon={<Flag className="h-3 w-3 text-rose-300" />}
                        className="border-rose-900/60 bg-rose-950/20 text-rose-200"
                    >
                        Ends at #{objective.endpointEncounter.sequence}
                        {objective.endpointEncounter.defender?.name ? ` ${objective.endpointEncounter.defender.name}` : ""}
                    </ObjectiveBadge>
                )}

                {lockedRouteCount > 0 && (
                    <ObjectiveBadge
                        icon={<Lock className="h-3 w-3 text-amber-300" />}
                        className="border-amber-800/60 bg-amber-950/30 text-amber-200"
                    >
                        {lockedRouteCount} locked
                    </ObjectiveBadge>
                )}

                {lockedRouteCount === 0 && routeDefaultCount > 0 && (
                    <ObjectiveBadge
                        icon={<Map className="h-3 w-3 text-slate-400" />}
                        className="border-slate-800 bg-slate-900/60 text-slate-400"
                    >
                        {routeDefaultCount} defaults
                    </ObjectiveBadge>
                )}

                {routeGuideCount > 0 && (
                    <ObjectiveBadge
                        icon={<Route className="h-3 w-3 text-cyan-300" />}
                        className="border-cyan-800/50 bg-cyan-950/25 text-cyan-200"
                    >
                        {routeGuideCount} route guide{routeGuideCount === 1 ? "" : "s"}
                    </ObjectiveBadge>
                )}
            </div>

            <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                <div className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                    {objective.slug}
                </div>
                <ActiveMarker active={active} />
            </div>
        </Link>
    );
}

export function QuestObjectiveSelector({
    questId,
    baseQuest,
    objectives,
    activeObjective,
}: QuestObjectiveSelectorProps) {
    const activeTitle = activeObjective?.shortTitle || activeObjective?.title || "Base Quest";

    return (
        <section className="mb-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 bg-slate-900/40 px-3 py-3 md:px-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="hidden h-8 w-8 items-center justify-center rounded-lg border border-amber-900/60 bg-amber-950/30 text-amber-300 sm:flex">
                        <Target className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                            Planning Objective
                        </h2>
                        <p className="mt-0.5 truncate text-[11px] text-slate-600">Active: {activeTitle}</p>
                    </div>
                </div>
                <div className="hidden shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:block">
                    {objectives.length + 1} scopes
                </div>
            </div>

            <div className="overflow-x-auto p-3 md:p-4">
                <div className="grid auto-cols-[minmax(260px,1fr)] grid-flow-col snap-x snap-mandatory gap-3 sm:grid-flow-row sm:grid-cols-2 xl:grid-cols-4">
                    <BaseQuestCard quest={baseQuest} active={!activeObjective} />
                    {objectives.map((objective) => (
                        <ObjectiveCard
                            key={objective.id}
                            questId={questId}
                            objective={objective}
                            active={activeObjective?.id === objective.id}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
