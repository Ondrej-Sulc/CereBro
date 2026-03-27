'use client';

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Crown, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type PublicPlayer = {
    id: string;
    ingameName: string;
    avatar: string | null;
    battlegroup: number | null;
    isOfficer: boolean;
    championPrestige: number | null;
    _count: { roster: number };
};

interface AlliancePublicData {
    id: string;
    name: string;
    battlegroup1Color: string;
    battlegroup2Color: string;
    battlegroup3Color: string;
    players: PublicPlayer[];
}

interface Props {
    alliance: AlliancePublicData;
    currentUser: { allianceId: string | null };
}

export function AlliancePublicClient({ alliance, currentUser }: Props) {
    const [sortBy, setSortBy] = useState<'name' | 'prestige'>('name');

    const isOwnAlliance = currentUser.allianceId === alliance.id;

    const sortPlayers = (players: PublicPlayer[]) => {
        if (sortBy === 'prestige') {
            return [...players].sort((a, b) => (b.championPrestige ?? 0) - (a.championPrestige ?? 0));
        }
        return [...players].sort((a, b) => a.ingameName.localeCompare(b.ingameName, undefined, { sensitivity: 'base' }));
    };

    const groups = useMemo(() => ({
        unassigned: sortPlayers(alliance.players.filter(p => !p.battlegroup)),
        bg1: sortPlayers(alliance.players.filter(p => p.battlegroup === 1)),
        bg2: sortPlayers(alliance.players.filter(p => p.battlegroup === 2)),
        bg3: sortPlayers(alliance.players.filter(p => p.battlegroup === 3)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [alliance.players, sortBy]);

    const bgStats = useMemo(() => {
        const compute = (players: PublicPlayer[]) => {
            const withPrestige = players.filter(p => p.championPrestige != null);
            const avg = withPrestige.length > 0
                ? Math.round(withPrestige.reduce((sum, p) => sum + (p.championPrestige ?? 0), 0) / withPrestige.length)
                : null;
            return { count: players.length, avgPrestige: avg };
        };
        return {
            unassigned: compute(alliance.players.filter(p => !p.battlegroup)),
            bg1: compute(alliance.players.filter(p => p.battlegroup === 1)),
            bg2: compute(alliance.players.filter(p => p.battlegroup === 2)),
            bg3: compute(alliance.players.filter(p => p.battlegroup === 3)),
        };
    }, [alliance.players]);

    const renderColumn = (
        title: string,
        players: PublicPlayer[],
        icon: React.ReactNode,
        accentColor?: string,
        stats?: { count: number; avgPrestige: number | null }
    ) => (
        <div className="flex-1 min-w-[300px] flex flex-col gap-3">
            <div
                className="flex items-center gap-2 pb-1.5 border-b transition-colors"
                style={{ borderColor: accentColor ? `${accentColor}40` : '#1e293b' }}
            >
                <div style={{ color: accentColor || '#94a3b8' }}>
                    {icon}
                </div>
                <h3 className="font-bold text-base" style={{ color: accentColor || '#e2e8f0' }}>{title}</h3>
                <div className="ml-auto flex items-center gap-2">
                    {stats?.avgPrestige != null && (
                        <span className="text-[10px] text-slate-500">avg {stats.avgPrestige.toLocaleString('en-US')}</span>
                    )}
                    <Badge variant="secondary" className="text-[10px] h-4">{stats?.count ?? players.length}</Badge>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                {players.map(player => (
                    <Card key={player.id} className="bg-slate-900/50 border-slate-800 overflow-hidden">
                        <CardContent className="p-2.5 flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-700">
                                <AvatarImage src={player.avatar || undefined} />
                                <AvatarFallback className="text-xs">{player.ingameName.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 overflow-hidden">
                                <div className="flex items-center gap-1.5">
                                    <Link href={`/player/${player.id}`} className="font-semibold text-sm truncate hover:text-sky-400 transition-colors">
                                        {player.ingameName}
                                    </Link>
                                    {player.isOfficer && <Crown className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    Prestige: {player.championPrestige?.toLocaleString('en-US') || "N/A"}
                                    <span className="text-slate-600"> · </span>
                                    {player._count.roster.toLocaleString('en-US')} champs
                                </p>
                            </div>
                            <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                                {(player.battlegroup ?? 0) > 0 ? `BG ${player.battlegroup}` : 'No BG'}
                            </Badge>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );

    return (
        <div className="container mx-auto py-6 px-4">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{alliance.name}</h1>
                        {isOwnAlliance && (
                            <Link href="/alliance">
                                <Badge variant="outline" className="text-[10px] border-sky-800 text-sky-400 hover:bg-sky-950/30 transition-colors">
                                    Your Alliance
                                </Badge>
                            </Link>
                        )}
                    </div>
                    <p className="text-sm text-slate-400">
                        {alliance.players.length} members
                    </p>
                </div>

                <div className="flex items-center rounded-md border border-slate-700 bg-slate-900/50 p-0.5">
                    <button
                        onClick={() => setSortBy('name')}
                        aria-pressed={sortBy === 'name'}
                        className={cn("px-2.5 py-1 text-xs rounded transition-colors", sortBy === 'name' ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200")}
                    >
                        Name
                    </button>
                    <button
                        onClick={() => setSortBy('prestige')}
                        aria-pressed={sortBy === 'prestige'}
                        className={cn("px-2.5 py-1 text-xs rounded transition-colors", sortBy === 'prestige' ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200")}
                    >
                        Prestige
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {renderColumn("Unassigned", groups.unassigned, <Users className="w-5 h-5" />, undefined, bgStats.unassigned)}
                {renderColumn("Battlegroup 1", groups.bg1, <Shield className="w-5 h-5" />, alliance.battlegroup1Color, bgStats.bg1)}
                {renderColumn("Battlegroup 2", groups.bg2, <Shield className="w-5 h-5" />, alliance.battlegroup2Color, bgStats.bg2)}
                {renderColumn("Battlegroup 3", groups.bg3, <Shield className="w-5 h-5" />, alliance.battlegroup3Color, bgStats.bg3)}
            </div>
        </div>
    );
}
