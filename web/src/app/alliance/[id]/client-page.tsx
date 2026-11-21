"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Camera, ChevronDown, ChevronRight, Clock3, Crown, Heart, LayoutGrid, List, Shield, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ALLIANCE_UNLOCK_THRESHOLD_MINOR } from "@cerebro/core/services/rosterScreenshotQuotaService";
import { requestToJoinAlliance } from "../../actions/alliance";
import { AllianceMemberList, AllianceMemberListSort, sortAllianceMembers, type MemberListSort } from "../member-list";
import { AllianceMemberSearch } from "../member-search";

type PublicPlayer = {
    id: string;
    ingameName: string;
    avatar: string | null;
    battlegroup: number | null;
    isOfficer: boolean;
    isSupporter: boolean;
    championPrestige: number | null;
    _count: { roster: number };
};

interface AlliancePublicData {
    id: string;
    name: string;
    tag: string | null;
    description: string | null;
    inviteOnly: boolean;
    battlegroup1Color: string;
    battlegroup2Color: string;
    battlegroup3Color: string;
    screenshotUnlock?: {
        currentMonthMinor: number;
        thresholdMinor: number;
        unlocked: boolean;
    };
    players: PublicPlayer[];
}

interface Props {
    alliance: AlliancePublicData;
    currentUser: { id: string; allianceId: string | null };
    pendingJoinRequestId?: string | null;
}

const viewOptions = [
    { value: "board", label: "Board", icon: LayoutGrid },
    { value: "list", label: "List", icon: List },
] as const;

const euro = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" });

function averagePrestige(players: PublicPlayer[]) {
    const values = players.flatMap(player => player.championPrestige ?? []);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function battlegroupColor(color: string, fallback: string) {
    return /^#[\da-f]{6}$/i.test(color) ? color : fallback;
}

export function AlliancePublicClient({ alliance, currentUser, pendingJoinRequestId = null }: Props) {
    const { toast } = useToast();
    const [sentRequest, setSentRequest] = useState(false);
    const [isRequestingJoin, setIsRequestingJoin] = useState(false);
    const [view, setView] = useState<"board" | "list">("board");
    const [sort, setSort] = useState<MemberListSort>("name");
    const [groupFilter, setGroupFilter] = useState<number | null | "all">("all");
    const [search, setSearch] = useState("");
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const searchInput = useRef<HTMLInputElement>(null);

    const isOwnAlliance = currentUser.allianceId === alliance.id;
    const hasPendingRequest = Boolean(pendingJoinRequestId) || sentRequest;
    const canRequestToJoin = !currentUser.allianceId && !alliance.inviteOnly && !hasPendingRequest;
    const { currentMonthMinor, thresholdMinor, unlocked } = alliance.screenshotUnlock ?? {
        currentMonthMinor: 0,
        thresholdMinor: ALLIANCE_UNLOCK_THRESHOLD_MINOR,
        unlocked: false,
    };
    const fundedPercent = unlocked ? 100 : Math.min(99, Math.round(currentMonthMinor / thresholdMinor * 100));
    const remainingMinor = Math.max(0, thresholdMinor - currentMonthMinor);

    async function handleRequestToJoin() {
        if (isRequestingJoin) return;
        setIsRequestingJoin(true);
        try {
            const result = await requestToJoinAlliance(alliance.id);
            if (result && "error" in result) {
                toast({ title: "Request failed", description: result.error, variant: "destructive" });
                return;
            }
            setSentRequest(true);
            toast({ title: "Request sent", description: "Alliance officers can review your request." });
        } catch (error: unknown) {
            toast({
                title: "Request failed",
                description: error instanceof Error ? error.message : "Failed to send join request",
                variant: "destructive",
            });
        } finally {
            setIsRequestingJoin(false);
        }
    }

    const groupColors = new Map<number | null, string>([
        [1, battlegroupColor(alliance.battlegroup1Color, "#ef4444")],
        [2, battlegroupColor(alliance.battlegroup2Color, "#22c55e")],
        [3, battlegroupColor(alliance.battlegroup3Color, "#3b82f6")],
        [null, "#94a3b8"],
    ]);
    const players = alliance.players.map(player => ({
        ...player,
        battlegroup: groupColors.has(player.battlegroup) ? player.battlegroup : null,
    }));
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = (player: PublicPlayer) => selectedPlayerId
        ? player.id === selectedPlayerId
        : player.ingameName.toLocaleLowerCase().includes(query);
    const groups = [...groupColors].map(([id, color]) => {
        const members = players.filter(player => player.battlegroup === id);
        return {
            id,
            color,
            title: id ? "Battlegroup " + id : "Unassigned",
            total: members.length,
            average: averagePrestige(members),
            supporterCount: members.filter(player => player.isSupporter).length,
            members: members.filter(matchesSearch),
        };
    }).filter(group => group.id !== null || group.total > 0);

    const scopedGroup = groups.find(group => group.id === groupFilter);
    const scopedGroups = scopedGroup ? [scopedGroup] : groups;
    const visibleGroups = query ? scopedGroups.filter(group => group.members.length > 0) : scopedGroups;
    const matchingMembers = visibleGroups.flatMap(group => group.members);
    const suggestions = query && !selectedPlayerId ? matchingMembers
        .map(player => ({
            id: player.id,
            name: player.ingameName,
            group: player.battlegroup ? "Battlegroup " + player.battlegroup : "Unassigned",
            color: groupColors.get(player.battlegroup) ?? "#94a3b8",
        }))
        .sort((a, b) => Number(b.name.toLocaleLowerCase().startsWith(query)) - Number(a.name.toLocaleLowerCase().startsWith(query)) || a.name.localeCompare(b.name))
        .slice(0, 8) : [];
    const rosterCount = players.filter(player => player._count.roster > 0).length;
    const alliancePrestige = averagePrestige(players);
    const hasResults = matchingMembers.length > 0;
    const emptyMessage = query ? "No members match “" + search.trim() + "”" + (scopedGroup ? " in " + scopedGroup.title : "") + "."
        : scopedGroup ? "No members assigned to this battlegroup yet." : "No alliance members yet.";

    return (
        <div className="mx-auto max-w-[1280px] space-y-6 px-4 pb-12 pt-5 sm:px-6 sm:pt-7 lg:space-y-7 lg:px-8">
            <header className="space-y-4 sm:space-y-5">
                <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
                    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 sm:gap-x-4 md:items-start">
                        <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-indigo-300/20 bg-[linear-gradient(145deg,#25264a,#111827)] text-indigo-200 sm:size-14 sm:rounded-2xl">
                            <Shield className="size-6 sm:size-7" strokeWidth={1.65} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            {alliance.tag && <p className="break-words font-mono text-xs font-semibold text-indigo-300">[{alliance.tag}]</p>}
                            <h1 className="break-words text-[1.75rem] font-bold leading-tight tracking-tight text-white sm:text-4xl">{alliance.name}</h1>
                        </div>
                        {alliance.description && (
                            <p className="col-span-2 max-w-3xl whitespace-pre-line break-words text-sm leading-relaxed text-slate-300 sm:col-span-1 sm:col-start-2">{alliance.description}</p>
                        )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                        {isOwnAlliance ? (
                            <Button asChild variant="outline" className="h-10 rounded-lg border-indigo-300/30 bg-slate-950/45 text-indigo-100 hover:bg-indigo-400/15 hover:text-white">
                                <Link href="/alliance">My alliance <ArrowUpRight aria-hidden="true" /></Link>
                            </Button>
                        ) : hasPendingRequest ? (
                            <span role="status" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-indigo-300/25 bg-indigo-400/10 px-3 text-sm font-medium text-indigo-100">
                                <Clock3 className="size-4" aria-hidden="true" /> Request pending
                            </span>
                        ) : canRequestToJoin ? (
                            <Button type="button" onClick={handleRequestToJoin} disabled={isRequestingJoin} className="h-10 rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 focus-visible:ring-indigo-300">
                                <UserPlus aria-hidden="true" /> {isRequestingJoin ? "Sending request…" : "Request to join"}
                            </Button>
                        ) : (
                            <span className={cn("inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium",
                                alliance.inviteOnly ? "border-amber-300/25 bg-amber-400/10 text-amber-200" : "border-indigo-300/25 bg-indigo-400/10 text-indigo-100"
                            )}>
                                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                                {alliance.inviteOnly ? "Invite only" : "Open to join requests"}
                            </span>
                        )}
                    </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(17rem,28%)]">
                    <dl className="grid grid-cols-3 divide-x divide-slate-800/80">
                        <div className="flex min-w-0 flex-col-reverse justify-end gap-0.5 px-3 py-2.5 sm:px-5 sm:py-3.5">
                            <dt className="text-xs font-medium leading-snug text-slate-400">Members</dt>
                            <dd className="text-xl font-semibold tabular-nums leading-tight tracking-tight text-white sm:text-2xl">{players.length}</dd>
                        </div>
                        <div className="flex min-w-0 flex-col-reverse justify-end gap-0.5 px-3 py-2.5 sm:px-5 sm:py-3.5">
                            <dt className="text-xs font-medium leading-snug text-slate-400">Avg. prestige</dt>
                            <dd className="text-xl font-semibold tabular-nums leading-tight tracking-tight text-white sm:text-2xl">{alliancePrestige?.toLocaleString("en-US") ?? "—"}</dd>
                        </div>
                        <div className="flex min-w-0 flex-col-reverse justify-end gap-0.5 px-3 py-2.5 sm:px-5 sm:py-3.5">
                            <dt className="text-xs font-medium leading-snug text-slate-400">Rosters on file</dt>
                            <dd className="text-xl font-semibold tabular-nums leading-tight tracking-tight text-white sm:text-2xl">
                                {rosterCount}<span className="text-xs font-medium text-slate-400 sm:text-sm"> / {players.length}</span>
                            </dd>
                        </div>
                    </dl>
                    <details className="group border-t border-slate-800/80 bg-slate-950/25 lg:border-l lg:border-t-0">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-xs hover:bg-slate-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 sm:px-5 lg:min-h-full lg:group-open:min-h-11 [&::-webkit-details-marker]:hidden">
                            <Camera className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                            <span className="flex-1 font-medium text-slate-200">Screenshot uploads</span>
                            <span className={cn("rounded-full border px-2 py-0.5 tabular-nums", unlocked ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-amber-400/25 bg-amber-400/10 text-amber-200")}>
                                {unlocked ? "Unlimited" : fundedPercent + "% funded"}
                            </span>
                            <ChevronDown className="size-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                        </summary>
                        <div className="space-y-2 px-3 pb-3 text-xs leading-relaxed text-slate-400 sm:px-5">
                            <div role="progressbar" aria-label="Funding for unlimited roster screenshot uploads" aria-valuenow={fundedPercent} className="h-1 overflow-hidden rounded-full bg-slate-800">
                                <div className={cn("h-full rounded-full", unlocked ? "bg-emerald-400" : "bg-amber-400")} style={{ width: fundedPercent + "%" }} />
                            </div>
                            <p>
                                {unlocked
                                    ? euro.format(currentMonthMinor / 100) + " in support over the last 30 days. Alliance members have unlimited roster uploads."
                                    : euro.format(currentMonthMinor / 100) + " of " + euro.format(thresholdMinor / 100) + " funded in the last 30 days. " + euro.format(remainingMinor / 100) + " more for unlimited roster uploads."}
                            </p>
                        </div>
                    </details>
                </div>
            </header>

            <section aria-labelledby="public-alliance-members" className="space-y-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center justify-between gap-2 xl:shrink-0 xl:gap-3">
                        <h2 id="public-alliance-members" className="text-2xl font-bold tracking-tight text-white">Members</h2>
                        {players.length > 0 && <div role="group" aria-label="Member view" className="inline-flex gap-0.5 rounded-lg border border-slate-800 bg-slate-900/65 p-0.5">
                            {viewOptions.map(({ value, label, icon: Icon }) => (
                                <Button key={value} type="button" size="sm" variant="ghost" aria-pressed={view === value} aria-controls="public-alliance-results" onClick={() => setView(value)} className={cn(
                                    "h-[34px] gap-1.5 rounded-md px-2.5 focus-visible:ring-indigo-400 [&_svg]:size-3.5",
                                    view === value ? "bg-indigo-400/15 text-indigo-100 hover:bg-indigo-400/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                )}>
                                    <Icon aria-hidden="true" /> {label}
                                </Button>
                            ))}
                        </div>}
                    </div>
                    {players.length > 0 && (
                        <div className="flex min-w-0 flex-col items-start justify-between gap-2 lg:flex-row lg:items-center xl:flex-1 xl:gap-3">
                            <div role="group" aria-label="Filter by battlegroup" className="inline-flex w-full flex-wrap gap-0.5 rounded-lg border border-slate-800 bg-slate-900/65 p-0.5 sm:w-auto">
                                {[{ id: "all" as const, title: "All battlegroups", color: null, total: players.length }, ...groups].map(group => {
                                    const active = (scopedGroup ? scopedGroup.id : "all") === group.id;
                                    return (
                                        <Button key={group.id ?? "unassigned"} type="button" variant="ghost" size="sm" aria-pressed={active} aria-controls="public-alliance-results"
                                            aria-label={group.title + ", " + group.total + (group.total === 1 ? " member" : " members")}
                                            onClick={() => setGroupFilter(group.id)}
                                            className={cn("h-9 flex-1 gap-1.5 rounded-md px-2 text-xs focus-visible:ring-indigo-400 sm:flex-none sm:px-2.5", active ? "bg-indigo-400/15 text-indigo-100 hover:bg-indigo-400/20" : "text-slate-300 hover:bg-slate-800 hover:text-white")}
                                        >
                                            {group.color && <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: group.color }} />}
                                            {group.id === "all" ? "All" : group.id === null ? "Unassigned" : "BG " + group.id}
                                            <span aria-hidden="true" className="hidden rounded bg-slate-800 px-1 py-0.5 text-[10px] leading-none tabular-nums text-slate-300 min-[380px]:inline">{group.total}</span>
                                        </Button>
                                    );
                                })}
                            </div>
                            <div className="flex w-full min-w-0 items-center gap-2 lg:w-auto">
                                <AllianceMemberSearch
                                    value={search}
                                    suggestions={suggestions}
                                    inputRef={searchInput}
                                    onChange={value => {
                                        setSearch(value);
                                        setSelectedPlayerId(null);
                                    }}
                                    onSelect={player => {
                                        setSearch(player.name);
                                        setSelectedPlayerId(player.id);
                                    }}
                                />
                                <AllianceMemberListSort value={sort} onChange={setSort} canSeeRosterUpdates={false} />
                            </div>
                        </div>
                    )}
                </div>

                <div id="public-alliance-results" className="space-y-3">
                    {query && hasResults && <p role="status" className="text-sm text-slate-400">{matchingMembers.length} matching {matchingMembers.length === 1 ? "member" : "members"}</p>}
                    {!hasResults ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-4">
                            <p role="status" className="min-w-0 break-words text-sm text-slate-400">{emptyMessage}</p>
                            {query && scopedGroup && (
                                <Button type="button" variant="link" size="sm" onClick={() => {
                                    setGroupFilter("all");
                                    searchInput.current?.focus();
                                }} className="h-auto px-0 py-0.5 text-indigo-300">Search all battlegroups</Button>
                            )}
                        </div>
                    ) : view === "list" ? (
                        <AllianceMemberList members={matchingMembers} sort={sort} groupColors={groupColors} emptyMessage={emptyMessage} />
                    ) : (
                        <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {visibleGroups.map(group => {
                                const headingId = "public-alliance-group-" + (group.id ?? "unassigned");
                                const wide = visibleGroups.length === 1 || group.id === null;
                                return (
                                    <section key={headingId} aria-labelledby={headingId} className={cn("min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50", wide && "col-span-full")}>
                                        <div className="flex items-center justify-between gap-3 border-b border-slate-800 border-l-2 py-2.5 pl-3 pr-8 sm:py-3"
                                            style={{ borderLeftColor: group.color, backgroundImage: "linear-gradient(100deg, " + group.color + "16, transparent 70%)" }}>
                                            <div className="min-w-0">
                                                <h3 id={headingId} className="text-base font-semibold tracking-tight text-white">{group.title}</h3>
                                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs tabular-nums text-slate-400">
                                                    <span>
                                                        {query && group.members.length !== group.total ? group.members.length + " / " : ""}{group.total} {group.total === 1 ? "member" : "members"}
                                                    </span>
                                                    {group.supporterCount > 0 && <span className="inline-flex items-center gap-1 text-amber-300" title={group.supporterCount + (group.supporterCount === 1 ? " supporter" : " supporters")}>
                                                        <Heart className="size-3" aria-hidden="true" />{group.supporterCount}<span className="sr-only"> {group.supporterCount === 1 ? "supporter" : "supporters"}</span>
                                                    </span>}
                                                </div>
                                            </div>
                                            {group.average !== null && (
                                                <p className="shrink-0 text-right text-xs text-slate-400">
                                                    <span className="block text-sm font-semibold tabular-nums text-slate-100">{group.average.toLocaleString("en-US")}</span>
                                                    Avg. prestige
                                                </p>
                                            )}
                                        </div>
                                        {group.members.length ? (
                                            <ul className={cn("divide-y divide-slate-800/70", wide && group.members.length > 1 && "md:grid md:grid-cols-2 md:divide-y-0 md:[&>li]:border-b md:[&>li]:border-r md:[&>li]:border-slate-800/70", wide && group.members.length > 2 && "xl:grid-cols-3")}>
                                                {sortAllianceMembers(group.members, sort).map(player => (
                                                    <li key={player.id} className="min-w-0">
                                                        <Link href={"/player/" + player.id} className="group flex min-h-[3.25rem] min-w-0 items-center gap-2.5 px-3.5 py-2 transition-colors hover:bg-slate-800/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400">
                                                            <Avatar className="size-8 shrink-0 rounded-lg border" style={{ borderColor: (player.isSupporter ? "#fbbf24" : group.color) + "55" }}>
                                                                <AvatarImage src={player.avatar ?? undefined} alt="" />
                                                                <AvatarFallback className="rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: group.color + "24" }}>{player.ingameName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex min-w-0 items-center gap-1.5">
                                                                    <span className="truncate text-sm font-semibold text-slate-100 group-hover:text-indigo-200" title={player.ingameName}>{player.ingameName}</span>
                                                                    {player.isOfficer && <Crown role="img" aria-label="Officer" className="size-3.5 shrink-0 text-amber-300" />}
                                                                    {player.isSupporter && <Heart role="img" aria-label="Supporter" className="size-3.5 shrink-0 fill-amber-300/20 text-amber-300" />}
                                                                </div>
                                                                <p className="text-xs tabular-nums text-slate-400">{player._count.roster.toLocaleString("en-US")} {player._count.roster === 1 ? "champion" : "champions"}</p>
                                                            </div>
                                                            <span className="flex shrink-0 items-center gap-1.5">
                                                                <span className="text-right text-sm font-medium tabular-nums text-slate-200">
                                                                    {player.championPrestige?.toLocaleString("en-US") ?? "—"}<span className="sr-only"> champion prestige</span>
                                                                </span>
                                                                <ChevronRight className="size-3 shrink-0 text-slate-500 group-hover:text-indigo-200" aria-hidden="true" />
                                                            </span>
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : <p className="px-4 py-4 text-sm text-slate-400">No members assigned yet.</p>}
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
