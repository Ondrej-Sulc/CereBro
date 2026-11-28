"use client";

import type { Player } from "@prisma/client";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, ClipboardList, Crown, Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const sortOptions = {
    name: { label: "Name (A–Z)", shortLabel: "Name A–Z", column: "name", direction: "ascending" },
    "name-desc": { label: "Name (Z–A)", shortLabel: "Name Z–A", column: "name", direction: "descending" },
    prestige: { label: "Prestige (highest first)", shortLabel: "Highest prestige", column: "prestige", direction: "descending" },
    "prestige-asc": { label: "Prestige (lowest first)", shortLabel: "Lowest prestige", column: "prestige", direction: "ascending" },
    "roster-newest": { label: "Roster update (newest first)", shortLabel: "Newest update", column: "roster", direction: "descending" },
    "roster-oldest": { label: "Roster update (oldest first)", shortLabel: "Oldest update", column: "roster", direction: "ascending" },
} as const;

export type MemberListSort = keyof typeof sortOptions;

type Member = Pick<Player, "id" | "ingameName" | "avatar" | "battlegroup" | "championPrestige" | "isOfficer"> & {
    _count: { roster: number };
    isPlanner?: boolean;
    rosterLastUpdatedAt?: Date | string | null;
    isSupporter?: boolean;
};

type RosterFreshness = { state: "fresh" | "stale" | "missing" | "unknown"; label: string };

export function AllianceMemberListSort({ value, onChange, canSeeRosterUpdates }: {
    value: MemberListSort;
    onChange: (value: MemberListSort) => void;
    canSeeRosterUpdates: boolean;
}) {
    const choices = (Object.keys(sortOptions) as MemberListSort[]).filter(key =>
        canSeeRosterUpdates || sortOptions[key].column !== "roster"
    );
    return (
        <Select value={value} onValueChange={key => onChange(key as MemberListSort)}>
            <SelectTrigger aria-label="Sort member list" className="h-10 w-auto min-w-[7.75rem] shrink-0 gap-1.5 rounded-lg border-slate-700/80 bg-slate-900/65 px-2.5 text-xs text-slate-200 focus:ring-indigo-400 sm:min-w-[9rem]">
                <SelectValue>{sortOptions[value].shortLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className="border-slate-700 bg-slate-900 text-slate-100">
                {choices.map(key => <SelectItem key={key} value={key}>{sortOptions[key].label}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

function rosterTimestamp(member: Member) {
    if (!member._count.roster || !member.rosterLastUpdatedAt) return null;
    const timestamp = new Date(member.rosterLastUpdatedAt).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
}

function compareValues(first: number | null, second: number | null, descending: boolean) {
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    return descending ? second - first : first - second;
}

export function sortAllianceMembers<T extends Member>(members: readonly T[], sort: MemberListSort): T[] {
    const { column, direction } = sortOptions[sort];
    const descending = direction === "descending";
    return [...members].sort((a, b) => {
        if (column === "prestige") {
            const order = compareValues(a.championPrestige, b.championPrestige, descending);
            if (order) return order;
        }
        if (column === "roster") {
            const order = compareValues(rosterTimestamp(a), rosterTimestamp(b), descending);
            if (order) return order;
        }
        const name = a.ingameName.localeCompare(b.ingameName, undefined, { sensitivity: "base" });
        return (column === "name" && descending ? -name : name) || a.id.localeCompare(b.id);
    });
}

export function AllianceMemberList({ members, sort, playerColors, groupColors, rosterFreshness, emptyMessage }: {
    members: Member[];
    sort: MemberListSort;
    playerColors?: ReadonlyMap<string, string>;
    groupColors: ReadonlyMap<number | null, string>;
    rosterFreshness?: ReadonlyMap<string, RosterFreshness>;
    emptyMessage: string;
}) {
    const { column, direction } = sortOptions[sort];
    const descending = direction === "descending";
    const SortIcon = descending ? ArrowDown : ArrowUp;
    const sorted = sortAllianceMembers(members, sort);

    if (!sorted.length) {
        return <p className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-5 text-sm text-slate-400">{emptyMessage}</p>;
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
            <Table className="table-fixed md:table-auto">
                <TableCaption className="sr-only">Alliance members</TableCaption>
                <TableHeader className="bg-slate-900">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead scope="col" aria-sort={column === "name" ? direction : undefined} className="px-3 text-xs text-slate-400 sm:px-4">
                            <span className="inline-flex items-center gap-1.5">Member {column === "name" && <SortIcon className="size-3 text-indigo-300" aria-hidden="true" />}</span>
                        </TableHead>
                        <TableHead scope="col" className="hidden px-4 text-xs text-slate-400 md:table-cell">Battlegroup</TableHead>
                        <TableHead scope="col" aria-sort={column === "prestige" ? direction : undefined} className="w-24 px-3 text-right text-xs text-slate-400 sm:px-4 md:w-auto">
                            <span className="inline-flex items-center gap-1.5">Prestige {column === "prestige" && <SortIcon className="size-3 text-indigo-300" aria-hidden="true" />}</span>
                        </TableHead>
                        <TableHead scope="col" className="hidden px-4 text-right text-xs text-slate-400 md:table-cell">Champions</TableHead>
                        {rosterFreshness && (
                            <TableHead scope="col" aria-sort={column === "roster" ? direction : undefined} className="hidden px-4 text-xs text-slate-400 md:table-cell">
                                <span className="inline-flex items-center gap-1.5">Roster update {column === "roster" && <SortIcon className="size-3 text-indigo-300" aria-hidden="true" />}</span>
                            </TableHead>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.map(member => {
                        const timestamp = rosterTimestamp(member);
                        const freshness = rosterFreshness?.get(member.id);
                        const needsAttention = freshness?.state === "missing" || freshness?.state === "stale";
                        const group = member.battlegroup || null;
                        const groupLabel = group === null ? "Unassigned" : "BG " + group;
                        const groupBadge = (
                            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-300">
                                <span className="size-1.5 rounded-full" style={{ backgroundColor: groupColors.get(group) ?? "#94a3b8" }} aria-hidden="true" />
                                {groupLabel}
                            </span>
                        );
                        const update = freshness && (
                            <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", needsAttention ? "text-amber-300" : "text-slate-400")}>
                                {needsAttention && <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />}
                                {timestamp === null ? freshness.label : <time dateTime={new Date(timestamp).toISOString()}>{freshness.label}</time>}
                            </span>
                        );
                        const playerColor = member.isSupporter ? "#fbbf24" : playerColors?.get(member.id) ?? groupColors.get(group) ?? "#94a3b8";
                        const profileHref = "/player/" + member.id;

                        return (
                            <TableRow key={member.id} className="border-slate-800/80 hover:bg-slate-800/45">
                                <TableCell className="px-3 py-2 sm:px-4">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <Link href={profileHref} aria-label={"View profile for " + member.ingameName} className="inline-flex shrink-0 rounded-lg transition-shadow hover:ring-1 hover:ring-indigo-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                                            <Avatar className="size-8 rounded-lg border" style={{ borderColor: playerColor + "66" }}>
                                                <AvatarImage src={member.avatar ?? undefined} alt="" />
                                                <AvatarFallback className="rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: playerColor + "24" }}>
                                                    {member.ingameName.slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </Link>
                                        <div className="min-w-0">
                                            <div className="flex min-w-0 items-center gap-1.5">
                                                <Link href={profileHref} title={member.ingameName} className="truncate rounded-sm text-sm font-medium text-slate-100 hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                                                    {member.ingameName}
                                                </Link>
                                                {member.isOfficer && <Crown role="img" aria-label="Officer" className="size-3 shrink-0 text-amber-300" />}
                                                {member.isPlanner && <ClipboardList role="img" aria-label="Planner" className="size-3 shrink-0 text-sky-300" />}
                                                {member.isSupporter && <Heart role="img" aria-label="Supporter" className="size-3 shrink-0 text-amber-300" />}
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400 md:hidden">
                                                {groupBadge}
                                                <span className="whitespace-nowrap">{member._count.roster.toLocaleString("en-US")} champs</span>
                                                {update}
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden px-4 py-2 md:table-cell">{groupBadge}</TableCell>
                                <TableCell className="px-3 py-2 text-right text-sm font-medium tabular-nums text-slate-100 sm:px-4">
                                    {member.championPrestige?.toLocaleString("en-US") ?? <><span aria-hidden="true" className="text-slate-500">—</span><span className="sr-only">Prestige not recorded</span></>}
                                </TableCell>
                                <TableCell className="hidden px-4 py-2 text-right text-sm tabular-nums text-slate-300 md:table-cell">{member._count.roster.toLocaleString("en-US")}</TableCell>
                                {rosterFreshness && <TableCell className="hidden px-4 py-2 md:table-cell">{update}</TableCell>}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
