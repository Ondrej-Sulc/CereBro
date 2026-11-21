"use client";

import type { Alliance, Player } from "@prisma/client";
import { ArrowLeft, ChevronDown, MapPin, Share2, Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlayerProfileHeader, PlayerProfileMetric, profileActionClass, profilePrimaryActionClass } from "@/components/player-profile-ui";
import { cn } from "@/lib/utils";

type RosterPlayer = Player & { alliance: Alliance | null };

export function RosterProfileHeader({ player, profiles, personal, showUpload, top30, owned, sevenStar, onShare, onProfileSwitch }: {
    player: RosterPlayer;
    profiles: RosterPlayer[];
    personal: boolean;
    showUpload: boolean;
    top30: number;
    owned: number;
    sevenStar: number;
    onShare?: () => void;
    onProfileSwitch: (profileId: string) => void;
}) {
    return (
        <PlayerProfileHeader
            name={player.ingameName}
            avatar={player.avatar}
            label={personal ? "My roster" : "Player roster"}
            details={<>
                {player.alliance && (
                    <Link href={"/alliance/" + player.alliance.id} className="inline-flex min-w-0 items-center gap-1.5 rounded-sm font-medium text-indigo-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="break-words">{player.alliance.name}</span>
                    </Link>
                )}
                {player.battlegroup ? <span className="rounded-md border border-slate-700 bg-slate-950/45 px-1.5 py-0.5 text-xs text-slate-300">BG {player.battlegroup}</span> : null}
                {profiles.length > 1 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 rounded-md px-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">
                                Switch profile <ChevronDown className="size-3 text-slate-400" aria-hidden="true" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52 rounded-xl border-slate-700 bg-slate-900 text-slate-100">
                            {profiles.map(profile => (
                                <DropdownMenuItem key={profile.id} onSelect={() => onProfileSwitch(profile.id)}>
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="break-words font-medium">{profile.ingameName}</span>
                                        {profile.alliance && <span className="break-words text-xs text-slate-400">{profile.alliance.name}</span>}
                                    </span>
                                    {profile.id === player.id && <span className="shrink-0 rounded-md bg-indigo-400/10 px-1.5 py-0.5 text-xs text-indigo-200">Active</span>}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </>}
            actions={<>
                {showUpload && (
                    <Link href="/profile/update" className={profilePrimaryActionClass}><Upload className="size-4" aria-hidden="true" /> Update roster</Link>
                )}
                <Link href={personal ? "/profile" : "/player/" + player.id} className={profileActionClass}>
                    <ArrowLeft className="size-4" aria-hidden="true" /> {personal ? "My profile" : "Player profile"}
                </Link>
                {onShare && (
                    <button type="button" title="Share roster" className={cn(profileActionClass, showUpload && "min-w-10 px-2 sm:px-3.5")} onClick={onShare}>
                        <Share2 className="size-4" aria-hidden="true" />
                        <span className={showUpload ? "sr-only sm:not-sr-only" : undefined}>Share</span>
                    </button>
                )}
            </>}
        >
            <dl className="grid grid-cols-3 gap-px border-t border-indigo-400/15 bg-slate-800/75">
                <PlayerProfileMetric label="Top 30 prestige" value={top30 > 0 ? top30.toLocaleString("en-US") : "—"} />
                <PlayerProfileMetric label="Owned builds" value={owned.toLocaleString("en-US")} />
                <PlayerProfileMetric label="Seven-star builds" value={sevenStar.toLocaleString("en-US")} />
            </dl>
        </PlayerProfileHeader>
    );
}
