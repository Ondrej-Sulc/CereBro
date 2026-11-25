"use client";

import { useState } from "react";
import { Loader2, Mail, Search, UserPlus, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AllianceDialogContent, allianceDialogTabClass, allianceDialogTabsClass } from "./alliance-dialog";

type SearchPlayer = {
    id: string;
    ingameName: string;
    avatar: string | null;
    allianceId: string | null;
    alliance: { name: string } | null;
};

type PendingRequest = {
    id: string;
    createdAt: Date;
    player: Pick<SearchPlayer, "ingameName" | "avatar">;
};

type PlayerSearch =
    | { state: "idle" }
    | { state: "loading" | "error"; query: string }
    | { state: "ready"; query: string; players: SearchPlayer[] };

export function RecruitDialog({ pendingRequests, loadingId, onInvite, onRespond }: {
    pendingRequests: PendingRequest[];
    loadingId: string | null;
    onInvite: (playerId: string) => Promise<void>;
    onRespond: (requestId: string, status: "ACCEPTED" | "REJECTED") => Promise<void>;
}) {
    const [query, setQuery] = useState("");
    const [search, setSearch] = useState<PlayerSearch>({ state: "idle" });
    const pendingCount = pendingRequests.length;

    const findPlayers = async () => {
        const searchQuery = query.trim();
        if (searchQuery.length < 2 || search.state === "loading") return;
        setSearch({ state: "loading", query: searchQuery });
        try {
            const response = await fetch("/api/player/search?q=" + encodeURIComponent(searchQuery));
            if (!response.ok) throw new Error("Player search failed");
            const players = await response.json();
            if (!Array.isArray(players)) throw new Error("Invalid player search response");
            setSearch({ state: "ready", query: searchQuery, players });
        } catch {
            setSearch({ state: "error", query: searchQuery });
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="relative h-11 min-w-0 gap-1 rounded-lg border-slate-800 bg-slate-900/65 px-1 text-xs text-slate-200 hover:bg-slate-800 sm:h-10 sm:gap-2 sm:px-3 sm:text-sm [&_svg]:size-3.5 sm:[&_svg]:size-4">
                    <UserPlus aria-hidden="true" />
                    Recruit<span className="sr-only"> members</span>
                    {pendingCount > 0 && (
                        <span className="absolute -right-0.5 -top-1 rounded-md bg-indigo-900 px-1 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-indigo-100 sm:static sm:bg-indigo-400/15 sm:px-1.5 sm:text-xs sm:leading-normal sm:text-indigo-200">
                            {pendingCount}<span className="sr-only"> pending {pendingCount === 1 ? "join request" : "join requests"}</span>
                        </span>
                    )}
                </Button>
            </DialogTrigger>
            <AllianceDialogContent title="Recruit members" description="Invite players or review requests to join your alliance." icon={UserPlus}>
                <Tabs defaultValue={pendingCount ? "requests" : "recruit"} className="flex min-h-0 flex-col">
                    <TabsList aria-label="Recruitment" className={allianceDialogTabsClass}>
                        <TabsTrigger value="recruit" className={allianceDialogTabClass}>
                            <Search className="size-4 shrink-0" aria-hidden="true" /> Find players
                        </TabsTrigger>
                        <TabsTrigger value="requests" className={allianceDialogTabClass}>
                            <Mail className="size-4 shrink-0" aria-hidden="true" /> Join requests
                            {pendingCount > 0 && (
                                <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs tabular-nums text-indigo-200">{pendingCount}</span>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="recruit" className="m-0 min-h-0 overflow-y-auto overscroll-contain p-4 focus-visible:ring-inset sm:p-6">
                        <form className="space-y-2" onSubmit={event => {
                            event.preventDefault();
                            void findPlayers();
                        }}>
                            <label htmlFor="recruit-player-search" className="text-sm font-medium text-slate-200">In-game name</label>
                            <div className="flex gap-2">
                                <div className="relative min-w-0 flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                    <Input id="recruit-player-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Enter at least 2 characters" autoComplete="off" className="h-10 rounded-lg border-slate-700 bg-slate-950/70 pl-9 focus-visible:ring-indigo-400" />
                                </div>
                                <Button type="submit" disabled={search.state === "loading" || query.trim().length < 2} className="h-10 rounded-lg bg-indigo-500 px-3 text-white hover:bg-indigo-400">
                                    {search.state === "loading" && <Loader2 className="animate-spin" aria-hidden="true" />}
                                    Search
                                </Button>
                            </div>
                            <p className="text-xs text-slate-400">You can invite players who aren’t already in an alliance.</p>
                        </form>

                        {search.state === "loading" && <p role="status" className="mt-4 text-sm text-slate-400">Searching for “{search.query}”…</p>}
                        {search.state === "error" && <p role="alert" className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">Couldn’t search for “{search.query}”. Try again.</p>}
                        {search.state === "ready" && (
                            <div className="mt-5 space-y-2">
                                <p role="status" className="text-xs font-medium text-slate-400">
                                    {search.players.length ? search.players.length + (search.players.length === 1 ? " player found" : " players found") + " for" : "No players found for"} “{search.query}”
                                </p>
                                {search.players.length > 0 && (
                                    <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/35">
                                        {search.players.map(player => (
                                            <li key={player.id} className="flex items-center gap-3 p-3">
                                                <Avatar className="size-9 shrink-0 rounded-xl border border-slate-700">
                                                    <AvatarImage src={player.avatar ?? undefined} />
                                                    <AvatarFallback className="rounded-xl">{player.ingameName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <p className="break-words text-sm font-medium text-slate-100">{player.ingameName}</p>
                                                    <p className="break-words text-xs text-slate-400">{player.alliance?.name ?? (player.allianceId ? "In an alliance" : "Available to invite")}</p>
                                                </div>
                                                {!player.allianceId && (
                                                    <Button size="sm" variant="outline" aria-label={"Invite " + player.ingameName} disabled={loadingId === player.id} onClick={() => onInvite(player.id)} className="shrink-0 rounded-lg border-indigo-400/25 bg-indigo-400/10 text-indigo-200 hover:bg-indigo-400/20">
                                                        {loadingId === player.id ? "Inviting…" : "Invite"}
                                                    </Button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="requests" className="m-0 min-h-0 overflow-y-auto overscroll-contain p-4 focus-visible:ring-inset sm:p-6">
                        {pendingCount === 0 ? (
                            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-800 py-8 text-center">
                                <Users className="size-5 text-indigo-300" aria-hidden="true" />
                                <p className="text-sm font-medium text-slate-300">No pending join requests</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/35">
                                {pendingRequests.map(request => (
                                    <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 p-3 sm:gap-3 sm:px-4">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Avatar className="size-9 shrink-0 rounded-xl border border-slate-700">
                                                <AvatarImage src={request.player.avatar ?? undefined} />
                                                <AvatarFallback className="rounded-xl">{request.player.ingameName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="break-words text-sm font-semibold text-slate-100">{request.player.ingameName}</p>
                                                <p className="text-xs text-slate-400">Requested {new Date(request.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                                            </div>
                                        </div>
                                        <div className="ml-auto flex shrink-0 items-center gap-2">
                                            <Button size="sm" variant="ghost" aria-label={"Decline " + request.player.ingameName} disabled={loadingId === request.id} onClick={() => onRespond(request.id, "REJECTED")} className="rounded-lg px-2 text-slate-300">Decline</Button>
                                            <Button size="sm" aria-label={"Accept " + request.player.ingameName} disabled={loadingId === request.id} onClick={() => onRespond(request.id, "ACCEPTED")} className="rounded-lg bg-emerald-400/15 px-2.5 text-emerald-200 hover:bg-emerald-400/25">Accept</Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </TabsContent>
                </Tabs>
            </AllianceDialogContent>
        </Dialog>
    );
}
