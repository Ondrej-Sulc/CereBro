"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BattlegroundsTournamentFormat,
  BattlegroundsTournamentScope,
  BattlegroundsTournamentStatus,
  TournamentParticipantStatus,
} from "@prisma/client";
import {
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Flag,
  Play,
  Plus,
  Swords,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addTournamentParticipant,
  createTournament,
  joinTournament,
  removeTournamentParticipant,
  updateTournamentStatus,
  type TournamentActionResult,
} from "./actions";

export type TournamentMember = {
  id: string;
  ingameName: string;
  battlegroup: number | null;
  championPrestige: number | null;
  avatar: string | null;
};

export type TournamentSummary = {
  id: string;
  name: string;
  description: string | null;
  scope: BattlegroundsTournamentScope;
  format: BattlegroundsTournamentFormat;
  status: BattlegroundsTournamentStatus;
  startsAt: string | null;
  checkInStartsAt: string | null;
  createdAt: string;
  allianceId: string | null;
  createdById: string;
  createdBy: { ingameName: string };
  participants: Array<{
    id: string;
    seed: number | null;
    battlegroup: number | null;
    status: TournamentParticipantStatus;
    checkedInAt: string | null;
    player: TournamentMember;
  }>;
  _count: { matches: number };
};

type Props = {
  allianceName: string;
  hasAlliance: boolean;
  currentPlayerId: string;
  bgColors: Record<number, string>;
  players: TournamentMember[];
  tournaments: TournamentSummary[];
  canCreate: boolean;
  manageableTournamentIds: string[];
};

const statusLabels: Record<BattlegroundsTournamentStatus, string> = {
  DRAFT: "Draft",
  REGISTRATION: "Registration",
  CHECK_IN: "Check-in",
  LIVE: "Live",
  FINISHED: "Finished",
  ARCHIVED: "Archived",
};

const formatLabels: Record<BattlegroundsTournamentFormat, string> = {
  SINGLE_ELIMINATION: "Single Elim",
  DOUBLE_ELIMINATION: "Double Elim",
  SWISS: "Swiss",
  SWISS_TOP_CUT: "Swiss + Top Cut",
  ROUND_ROBIN: "Round Robin",
  LADDER: "Ladder",
};

const formatDescriptions: Record<BattlegroundsTournamentFormat, string> = {
  SINGLE_ELIMINATION: "Lose once and you are out. Fastest option for small one-night brackets.",
  DOUBLE_ELIMINATION: "Players move to a lower bracket after one loss and are eliminated after the second loss.",
  SWISS: "Everyone plays a fixed number of rounds against players with similar records. Best for ranking a larger field.",
  SWISS_TOP_CUT: "Swiss rounds rank the field, then the top players advance to an elimination bracket.",
  ROUND_ROBIN: "Every player faces every other player. Clear and fair, but match count grows quickly.",
  LADDER: "Players climb by challenging nearby ranks. Best for longer-running flexible events.",
};

const scopeLabels: Record<BattlegroundsTournamentScope, string> = {
  COMMUNITY: "Community",
  ALLIANCE: "Alliance",
};

const participantLabels: Record<TournamentParticipantStatus, string> = {
  INVITED: "Invited",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  DROPPED: "Dropped",
};

function formatDate(value: string | null) {
  if (!value) return "Unscheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function appendTimezoneOffset(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value) return;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return;

  formData.set(`${key}TimezoneOffsetMinutes`, String(date.getTimezoneOffset()));
}

function statusTone(status: BattlegroundsTournamentStatus) {
  switch (status) {
    case "LIVE":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "CHECK_IN":
      return "border-sky-500/40 bg-sky-500/15 text-sky-200";
    case "REGISTRATION":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    case "FINISHED":
      return "border-violet-500/40 bg-violet-500/15 text-violet-200";
    case "ARCHIVED":
      return "border-slate-700 bg-slate-900 text-slate-400";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

function sortParticipants(tournament: TournamentSummary) {
  return [...tournament.participants].sort((a, b) => {
    const aSeed = a.seed ?? 9999;
    const bSeed = b.seed ?? 9999;
    if (aSeed !== bSeed) return aSeed - bSeed;
    const aBg = a.battlegroup ?? 99;
    const bBg = b.battlegroup ?? 99;
    if (aBg !== bBg) return aBg - bBg;
    return a.player.ingameName.localeCompare(b.player.ingameName);
  });
}

export function BattlegroundsTournamentsClient({
  allianceName,
  hasAlliance,
  currentPlayerId,
  bgColors,
  players,
  tournaments,
  canCreate,
  manageableTournamentIds,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTournamentId, setSelectedTournamentId] = useState(tournaments[0]?.id ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [formFormat, setFormFormat] = useState<BattlegroundsTournamentFormat>("SINGLE_ELIMINATION");
  const selectedTournament = tournaments.find((tournament) => tournament.id === selectedTournamentId) ?? tournaments[0] ?? null;
  const manageableTournamentIdSet = useMemo(
    () => new Set(manageableTournamentIds),
    [manageableTournamentIds]
  );

  const availableMembers = useMemo(() => {
    const participantIds = new Set(selectedTournament?.participants.map((entry) => entry.player.id) ?? []);
    return players
      .filter((member) => !participantIds.has(member.id))
      .filter((member) => selectedTournament?.scope !== "ALLIANCE" || member.battlegroup !== null)
      .sort((a, b) => {
        const aBg = a.battlegroup ?? 99;
        const bBg = b.battlegroup ?? 99;
        if (aBg !== bBg) return aBg - bBg;
        return a.ingameName.localeCompare(b.ingameName);
      });
  }, [players, selectedTournament]);

  const runAction = (action: () => Promise<TournamentActionResult>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      router.refresh();
    });
  };

  const participants = selectedTournament ? sortParticipants(selectedTournament) : [];
  const isCurrentUserEntered = participants.some((entry) => entry.player.id === currentPlayerId);
  const canManageSelected = !!selectedTournament && (
    manageableTournamentIdSet.has(selectedTournament.id) ||
    selectedTournament.createdById === currentPlayerId
  );
  const canJoinSelected = !!selectedTournament &&
    !isCurrentUserEntered &&
    ["REGISTRATION", "CHECK_IN"].includes(selectedTournament.status);
  const checkedInCount = participants.filter((entry) => entry.status === "CHECKED_IN").length;
  const bgCounts = [1, 2, 3].map((bg) => ({
    bg,
    count: participants.filter((entry) => entry.battlegroup === bg).length,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="border-slate-800/70 bg-slate-950/60 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-cyan-200">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Tournaments</p>
              <p className="text-2xl font-black text-white">{tournaments.length}</p>
            </div>
          </div>
        </Card>
        <Card className="border-slate-800/70 bg-slate-950/60 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-200">
              <Play className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Active</p>
              <p className="text-2xl font-black text-white">
                {tournaments.filter((tournament) => ["REGISTRATION", "CHECK_IN", "LIVE"].includes(tournament.status)).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="border-slate-800/70 bg-slate-950/60 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-200">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Current Field</p>
              <p className="text-2xl font-black text-white">{participants.length}</p>
            </div>
          </div>
        </Card>
        <Card className="border-slate-800/70 bg-slate-950/60 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-200">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Checked In</p>
              <p className="text-2xl font-black text-white">{checkedInCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {message && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Tournament Queue</h2>
              <p className="text-xs text-slate-500">{allianceName}</p>
            </div>
            {canCreate && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                    <Plus className="h-4 w-4" />
                    Create
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-slate-800 bg-slate-950 text-slate-100">
                  <DialogHeader>
                    <DialogTitle>Create Battlegrounds Tournament</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    action={(formData) => {
                      appendTimezoneOffset(formData, "startsAt");
                      appendTimezoneOffset(formData, "checkInStartsAt");
                      runAction(() => createTournament(formData));
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" name="name" placeholder="Friday BG Gauntlet" className="border-slate-800 bg-slate-900" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Organizer notes</Label>
                      <Textarea id="description" name="description" placeholder="Rules, deck limits, rewards, stream notes..." className="border-slate-800 bg-slate-900" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="scope">Scope</Label>
                        <select id="scope" name="scope" className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100">
                          <option value="COMMUNITY">Community / invite anyone</option>
                          {hasAlliance && <option value="ALLIANCE">Alliance only</option>}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="format">Format</Label>
                        <select
                          id="format"
                          name="format"
                          value={formFormat}
                          onChange={(event) => setFormFormat(event.target.value as BattlegroundsTournamentFormat)}
                          className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100"
                        >
                          <option value="SINGLE_ELIMINATION">Single Elimination</option>
                          <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                          <option value="SWISS">Swiss</option>
                          <option value="SWISS_TOP_CUT">Swiss + Top Cut</option>
                          <option value="ROUND_ROBIN">Round Robin</option>
                          <option value="LADDER">Ladder</option>
                        </select>
                        <p className="text-xs leading-5 text-slate-500">{formatDescriptions[formFormat]}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="startsAt">Start time</Label>
                        <Input id="startsAt" name="startsAt" type="datetime-local" className="border-slate-800 bg-slate-900" />
                        <p className="text-xs leading-5 text-slate-500">Saved using your device timezone.</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkInStartsAt">Check-in opens</Label>
                      <Input id="checkInStartsAt" name="checkInStartsAt" type="datetime-local" className="border-slate-800 bg-slate-900" />
                      <p className="text-xs leading-5 text-slate-500">Entrants will see this converted to their local time.</p>
                    </div>
                    <Button disabled={isPending} className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                      <Plus className="h-4 w-4" />
                      Create tournament
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="space-y-3">
            {tournaments.length === 0 && (
              <Card className="border-dashed border-slate-800 bg-slate-950/50 p-6 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-slate-700" />
                <p className="mt-3 font-semibold text-slate-300">No tournaments yet</p>
                <p className="mt-1 text-sm text-slate-500">Create one to start shaping the Battlegrounds flow.</p>
              </Card>
            )}
            {tournaments.map((tournament) => (
              <button
                key={tournament.id}
                onClick={() => setSelectedTournamentId(tournament.id)}
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition-colors",
                  selectedTournament?.id === tournament.id
                    ? "border-cyan-500/50 bg-cyan-500/10"
                    : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{tournament.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatLabels[tournament.format]} by {tournament.createdBy.ingameName}</p>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0", statusTone(tournament.status))}>
                    {statusLabels[tournament.status]}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{tournament.participants.length}</span>
                  <span className="flex items-center gap-1.5"><Swords className="h-3.5 w-3.5" />{scopeLabels[tournament.scope]}</span>
                  <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{formatDate(tournament.startsAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-w-0">
          {!selectedTournament ? (
            <Card className="border-slate-800 bg-slate-950/50 p-10 text-center">
              <Trophy className="mx-auto h-12 w-12 text-slate-700" />
              <p className="mt-3 text-lg font-bold text-slate-300">Create a tournament to open the organizer view.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="overflow-hidden border-slate-800/70 bg-slate-950/70">
                <div className="border-b border-slate-800 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-black tracking-tight text-white">{selectedTournament.name}</h2>
                        <Badge variant="outline" className={cn(statusTone(selectedTournament.status))}>
                          {statusLabels[selectedTournament.status]}
                        </Badge>
                        <Badge variant="outline" className="border-slate-700 text-slate-400">
                          {formatLabels[selectedTournament.format]}
                        </Badge>
                        <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                          {scopeLabels[selectedTournament.scope]}
                        </Badge>
                      </div>
                      {selectedTournament.description && (
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{selectedTournament.description}</p>
                      )}
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                        {formatDescriptions[selectedTournament.format]}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                    {canJoinSelected && (
                      <Button
                        disabled={isPending}
                        onClick={() => runAction(() => joinTournament(selectedTournament.id))}
                        className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Join
                      </Button>
                    )}
                    {canManageSelected && (
                      <Select
                        value={selectedTournament.status}
                        onValueChange={(value) => runAction(() => updateTournamentStatus(selectedTournament.id, value as BattlegroundsTournamentStatus))}
                      >
                        <SelectTrigger className="w-full border-slate-800 bg-slate-900 text-slate-100 sm:w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                          {Object.values(BattlegroundsTournamentStatus).map((status) => (
                            <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 border-b border-slate-800 md:grid-cols-3">
                  <div className="border-b border-slate-800 p-5 md:border-b-0 md:border-r">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Start</p>
                    <p className="mt-1 font-semibold text-slate-200">{formatDate(selectedTournament.startsAt)}</p>
                  </div>
                  <div className="border-b border-slate-800 p-5 md:border-b-0 md:border-r">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Check-in</p>
                    <p className="mt-1 font-semibold text-slate-200">{formatDate(selectedTournament.checkInStartsAt)}</p>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">BG Spread</p>
                    <div className="mt-2 flex gap-2">
                      {bgCounts.map(({ bg, count }) => (
                        <span key={bg} className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-300">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: bgColors[bg] }} />
                          BG{bg}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {canManageSelected && (
                  <form
                    className="grid grid-cols-1 gap-3 border-b border-slate-800 p-4 lg:grid-cols-[1fr_90px_150px_auto]"
                    action={(formData) => runAction(() => addTournamentParticipant(formData))}
                  >
                    <input type="hidden" name="tournamentId" value={selectedTournament.id} />
                    <select name="playerId" className="h-9 rounded-md border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100">
                      <option value="">Add player...</option>
                      {availableMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                        {member.ingameName}{member.battlegroup ? ` - BG${member.battlegroup}` : " - Community"}
                        </option>
                      ))}
                    </select>
                    <Input name="seed" inputMode="numeric" placeholder="Seed" className="border-slate-800 bg-slate-900" />
                    <select name="status" defaultValue="CONFIRMED" className="h-9 rounded-md border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100">
                      <option value="INVITED">Invited</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="CHECKED_IN">Checked in</option>
                    </select>
                    <Button disabled={isPending} className="bg-slate-100 text-slate-950 hover:bg-white">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </form>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-widest text-slate-500">
                      <tr>
                        <th className="w-20 px-4 py-3 text-left">Seed</th>
                        <th className="px-4 py-3 text-left">Player</th>
                        <th className="px-4 py-3 text-left">Battlegroup</th>
                        <th className="px-4 py-3 text-left">Prestige</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        {canManageSelected && <th className="w-16 px-4 py-3 text-right">Ops</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {participants.length === 0 && (
                        <tr>
                          <td colSpan={canManageSelected ? 6 : 5} className="px-4 py-12 text-center text-slate-500">
                            No entrants yet. Add alliance members to shape the field.
                          </td>
                        </tr>
                      )}
                      {participants.map((entry) => (
                        <tr key={entry.id} className="border-b border-slate-900/80">
                          <td className="px-4 py-3 font-mono font-bold text-slate-300">{entry.seed ?? "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-xs font-bold text-slate-300">
                                {entry.player.ingameName.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-200">{entry.player.ingameName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {entry.battlegroup ? (
                              <span className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-bold text-slate-300">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: bgColors[entry.battlegroup] }} />
                                BG{entry.battlegroup}
                              </span>
                            ) : (
                              <span className="text-slate-600">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-400">{entry.player.championPrestige ?? "-"}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold",
                              entry.status === "CHECKED_IN" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" :
                              entry.status === "CONFIRMED" ? "border-sky-500/30 bg-sky-500/10 text-sky-300" :
                              entry.status === "DROPPED" ? "border-red-500/30 bg-red-500/10 text-red-300" :
                              "border-slate-700 bg-slate-900 text-slate-400"
                            )}>
                              {entry.status === "CHECKED_IN" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}
                              {participantLabels[entry.status]}
                            </span>
                          </td>
                          {canManageSelected && (
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={isPending}
                                onClick={() => runAction(() => removeTournamentParticipant(entry.id))}
                                className="h-8 w-8 text-slate-500 hover:bg-red-950/30 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="border-slate-800/70 bg-slate-950/60 p-5">
                  <Flag className="h-5 w-5 text-cyan-300" />
                  <h3 className="mt-3 font-bold text-white">Registration Control</h3>
                  <p className="mt-1 text-sm text-slate-500">Host alliance-only friendlies or community events that anyone with a CereBro profile can join.</p>
                </Card>
                <Card className="border-slate-800/70 bg-slate-950/60 p-5">
                  <Users className="h-5 w-5 text-amber-300" />
                  <h3 className="mt-3 font-bold text-white">Field Organization</h3>
                  <p className="mt-1 text-sm text-slate-500">Seed players, keep battlegroup context visible, and identify unbalanced signup pools.</p>
                </Card>
                <Card className="border-slate-800/70 bg-slate-950/60 p-5">
                  <Swords className="h-5 w-5 text-emerald-300" />
                  <h3 className="mt-3 font-bold text-white">Bracket Ready</h3>
                  <p className="mt-1 text-sm text-slate-500">Single elim, double elim, Swiss, Swiss top cut, round robin, and ladder are now first-class formats.</p>
                </Card>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
