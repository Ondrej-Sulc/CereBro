"use client";

import { type ReactNode, useMemo, useState, useTransition } from "react";
import {
  BattlegroundsMatchStatus,
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
  Crown,
  Flag,
  Minus,
  Pencil,
  Plus,
  Swords,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  addTournamentParticipant,
  checkInTournamentParticipant,
  createTournamentMatch,
  deleteTournamentMatch,
  joinTournament,
  recordTournamentMatchResult,
  removeTournamentParticipant,
  startTournament,
  updateTournamentStatus,
  type TournamentActionResult,
} from "./actions";
import {
  formatDescriptions,
  formatLabels,
  matchStatusLabels,
  participantLabels,
  scopeLabels,
  statusLabels,
} from "./tournament-labels";

export type TournamentMember = {
  id: string;
  ingameName: string;
  allianceId: string | null;
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
  matches: Array<{
    id: string;
    round: number;
    matchNumber: number;
    status: BattlegroundsMatchStatus;
    homeParticipantId: string | null;
    awayParticipantId: string | null;
    winnerParticipantId: string | null;
    homeScore: number | null;
    awayScore: number | null;
    scheduledAt: string | null;
    notes: string | null;
    homeParticipant: {
      id: string;
      seed: number | null;
      battlegroup: number | null;
      status: TournamentParticipantStatus;
      checkedInAt: string | null;
      player: TournamentMember;
    } | null;
    awayParticipant: {
      id: string;
      seed: number | null;
      battlegroup: number | null;
      status: TournamentParticipantStatus;
      checkedInAt: string | null;
      player: TournamentMember;
    } | null;
    winnerParticipant: {
      id: string;
      seed: number | null;
      battlegroup: number | null;
      status: TournamentParticipantStatus;
      checkedInAt: string | null;
      player: TournamentMember;
    } | null;
  }>;
  _count: { matches: number };
};

type Props = {
  allianceName: string;
  currentPlayerId: string;
  bgColors: Record<number, string>;
  players: TournamentMember[];
  tournaments: TournamentSummary[];
  canCreate: boolean;
  manageableTournamentIds: string[];
  showTournamentQueue?: boolean;
};

type RunTournamentAction = (action: () => Promise<TournamentActionResult>) => Promise<TournamentActionResult>;
type TournamentMatch = TournamentSummary["matches"][number];
type TournamentMatchParticipant = NonNullable<TournamentMatch["homeParticipant"]>;

function matchStatusTone(status: BattlegroundsMatchStatus) {
  switch (status) {
    case "FINAL":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "DISPUTED":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "REPORTED":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "PLAYING":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    default:
      return "border-slate-700 bg-slate-900 text-slate-400";
  }
}

function formatDate(value: string | null) {
  if (!value) return "Unscheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

function nextLifecycleAction(status: BattlegroundsTournamentStatus, canStartAutomatically: boolean) {
  switch (status) {
    case "DRAFT":
      return { label: "Open registration", status: BattlegroundsTournamentStatus.REGISTRATION };
    case "REGISTRATION":
      return { label: "Open check-in", status: BattlegroundsTournamentStatus.CHECK_IN };
    case "CHECK_IN":
      return canStartAutomatically
        ? null
        : { label: "Set live", status: BattlegroundsTournamentStatus.LIVE };
    case "LIVE":
      return { label: "Finish tournament", status: BattlegroundsTournamentStatus.FINISHED };
    case "FINISHED":
      return { label: "Archive", status: BattlegroundsTournamentStatus.ARCHIVED };
    default:
      return null;
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

function groupMatchesByRound(tournament: TournamentSummary) {
  const groups = new Map<number, TournamentSummary["matches"]>();

  for (const match of tournament.matches) {
    const roundMatches = groups.get(match.round) ?? [];
    roundMatches.push(match);
    groups.set(match.round, roundMatches);
  }

  return [...groups.entries()].sort(([a], [b]) => a - b);
}

function nextPowerOfTwo(value: number) {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0;
}

function summonerCountGuidance(tournament: TournamentSummary) {
  const count = tournament.participants.length;

  if (count < 2) {
    return {
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      text: "Add at least 2 summoners to start fights.",
    };
  }

  if (tournament.format === "SINGLE_ELIMINATION") {
    if (isPowerOfTwo(count)) {
      return {
        tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
        text: `Clean ${count}-summoner bracket with no byes.`,
      };
    }

    const target = nextPowerOfTwo(count);
    const needed = target - count;
    return {
      tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
      text: `${count} works with ${needed} ${needed === 1 ? "bye" : "byes"}. Add ${needed} ${needed === 1 ? "summoner" : "summoners"} for a clean ${target}-summoner bracket.`,
    };
  }

  if (tournament.format === "ROUND_ROBIN") {
    const fightCount = count * (count - 1) / 2;
    return {
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      text: `${count} summoners create ${fightCount} fights.`,
    };
  }

  return {
    tone: "border-slate-700 bg-slate-900 text-slate-300",
    text: `${count} summoners. Pairings are manual for this format.`,
  };
}

function buildSingleEliminationSlots(tournament: TournamentSummary) {
  const bracketSize = Math.max(2, nextPowerOfTwo(tournament.participants.length));
  const roundCount = Math.log2(bracketSize);
  const matchesByRoundAndNumber = new Map<string, TournamentMatch>();

  for (const match of tournament.matches) {
    matchesByRoundAndNumber.set(`${match.round}:${match.matchNumber}`, match);
  }

  return Array.from({ length: roundCount }, (_, roundIndex) => {
    const round = roundIndex + 1;
    const slotCount = bracketSize / 2 ** round;

    return {
      round,
      slots: Array.from({ length: slotCount }, (_, slotIndex) => {
        const matchNumber = slotIndex + 1;
        return {
          matchNumber,
          match: matchesByRoundAndNumber.get(`${round}:${matchNumber}`) ?? null,
        };
      }),
    };
  });
}

function isWaitingForOpponent(tournament: TournamentSummary, match: TournamentMatch) {
  if (match.round === 1 || (match.homeParticipantId && match.awayParticipantId)) return false;

  const feederMatchNumbers = [match.matchNumber * 2 - 1, match.matchNumber * 2];
  return tournament.matches.some((candidate) => (
    candidate.round === match.round - 1 &&
    feederMatchNumbers.includes(candidate.matchNumber) &&
    candidate.status !== "FINAL"
  ));
}

function buildStandings(tournament: TournamentSummary) {
  const standings = new Map<string, {
    participant: TournamentSummary["participants"][number];
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
  }>();

  for (const participant of tournament.participants) {
    standings.set(participant.id, {
      participant,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const match of tournament.matches) {
    if (match.status !== "FINAL" || !match.homeParticipantId || !match.awayParticipantId) continue;

    const home = standings.get(match.homeParticipantId);
    const away = standings.get(match.awayParticipantId);
    if (!home || !away) continue;

    home.pointsFor += match.homeScore ?? 0;
    home.pointsAgainst += match.awayScore ?? 0;
    away.pointsFor += match.awayScore ?? 0;
    away.pointsAgainst += match.homeScore ?? 0;

    if (match.winnerParticipantId === match.homeParticipantId) {
      home.wins += 1;
      away.losses += 1;
    } else if (match.winnerParticipantId === match.awayParticipantId) {
      away.wins += 1;
      home.losses += 1;
    }
  }

  return [...standings.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aDiff = a.pointsFor - a.pointsAgainst;
    const bDiff = b.pointsFor - b.pointsAgainst;
    if (bDiff !== aDiff) return bDiff - aDiff;
    return sortParticipants({ ...tournament, participants: [a.participant, b.participant] })[0].id === a.participant.id ? -1 : 1;
  });
}

function participantMeta(participant: TournamentMatchParticipant | null) {
  if (!participant) return null;

  const parts = [];
  if (participant.seed !== null) parts.push(`Seed ${participant.seed}`);
  if (participant.battlegroup !== null) parts.push(`BG${participant.battlegroup}`);

  return parts.join(" / ");
}

function SummonerAvatar({
  player,
  className,
}: {
  player: TournamentMember;
  className?: string;
}) {
  return (
    <Avatar className={cn("h-6 w-6 border border-slate-700 bg-slate-900", className)}>
      <AvatarImage src={player.avatar || undefined} />
      <AvatarFallback className="text-[10px] font-bold text-slate-300">
        {player.ingameName.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function SummonerLink({
  player,
  className,
  avatarClassName,
}: {
  player: TournamentMember;
  className?: string;
  avatarClassName?: string;
}) {
  return (
    <Link
      href={`/player/${player.id}`}
      className={cn("group inline-flex min-w-0 items-center gap-2 hover:text-cyan-300", className)}
    >
      <SummonerAvatar player={player} className={avatarClassName} />
      <span className="truncate group-hover:underline group-hover:underline-offset-4">{player.ingameName}</span>
    </Link>
  );
}

function BracketPlayerRow({
  participant,
  fallbackName,
  score,
  isWinner,
  isBye,
  scoreSlot,
}: {
  participant: TournamentMatchParticipant | null;
  fallbackName: string;
  score: number | null;
  isWinner: boolean;
  isBye?: boolean;
  scoreSlot?: ReactNode;
}) {
  const meta = participantMeta(participant);
  const name = participant?.player.ingameName ?? fallbackName;

  return (
    <div className={cn(
      "grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5 transition-colors",
      isWinner
        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100 shadow-inner shadow-emerald-950/20"
        : "border-slate-800 bg-slate-950/70 text-slate-300",
      isBye && "text-slate-600"
    )}>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {isWinner && <Crown className="h-3.5 w-3.5 shrink-0 text-emerald-300" />}
          {isBye && <Flag className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
          {participant ? (
            <SummonerLink
              player={participant.player}
              className="text-sm font-semibold"
              avatarClassName="h-5 w-5"
            />
          ) : (
            <span className="truncate text-sm font-semibold">{name}</span>
          )}
        </div>
        {meta && <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">{meta}</p>}
      </div>
      {scoreSlot ?? (
        <span className={cn(
          "min-w-7 rounded border px-1.5 py-0.5 text-center font-mono text-sm",
          isWinner ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-slate-800 bg-slate-900 text-slate-500"
        )}>
          {score ?? "--"}
        </span>
      )}
    </div>
  );
}

function BracketScoreEditor({
  label,
  value,
  isWinner,
  isPending,
  onChange,
  onCommit,
  onStep,
}: {
  label: string;
  value: string;
  isWinner: boolean;
  isPending: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onStep: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={isPending}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onStep(-1)}
        className="h-6 w-4 text-slate-500 hover:text-slate-100"
        title={`Decrease ${label} score`}
        aria-label={`Decrease ${label} score`}
      >
        <Minus className="h-2.5 w-2.5" />
      </Button>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit();
          }
        }}
        placeholder="0"
        aria-label={`${label} score`}
        className={cn(
          "h-7 w-8 border-slate-800 bg-slate-950 px-0 text-center font-mono text-sm",
          isWinner && "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
        )}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={isPending}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onStep(1)}
        className="h-6 w-4 text-slate-500 hover:text-slate-100"
        title={`Increase ${label} score`}
        aria-label={`Increase ${label} score`}
      >
        <Plus className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}

function BracketMatchCard({
  tournament,
  match,
  canManage,
  isPending,
  runAction,
  rowStart,
  rowSpan,
  hasPreviousRound,
  hasNextRound,
}: {
  tournament: TournamentSummary;
  match: TournamentMatch;
  canManage: boolean;
  isPending: boolean;
  runAction: RunTournamentAction;
  rowStart: number;
  rowSpan: number;
  hasPreviousRound: boolean;
  hasNextRound: boolean;
}) {
  const firstPlayer = match.homeParticipant;
  const secondPlayer = match.awayParticipant;
  const isFinal = match.status === "FINAL";
  const isDisputed = match.status === "DISPUTED";
  const isActive = match.status === "PLAYING" || match.status === "REPORTED";
  const winnerParticipant = match.winnerParticipant;
  const waitingForOpponent = isWaitingForOpponent(tournament, match);
  const [firstScore, setFirstScore] = useState(match.homeScore?.toString() ?? "");
  const [secondScore, setSecondScore] = useState(match.awayScore?.toString() ?? "");
  const initialSavedKey = match.status === "FINAL" && match.winnerParticipantId
    ? `${match.homeScore ?? ""}:${match.awayScore ?? ""}:${match.winnerParticipantId}`
    : "";
  const [lastSavedKey, setLastSavedKey] = useState(initialSavedKey);
  const [savedLabel, setSavedLabel] = useState(initialSavedKey ? "Saved" : "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(initialSavedKey ? "saved" : "idle");
  const [isEditingFinalResult, setIsEditingFinalResult] = useState(false);

  if (!firstPlayer) {
    return null;
  }

  const showEditor = !isFinal || isEditingFinalResult;

  const saveResult = (
    nextFirstScore: string,
    nextSecondScore: string,
    nextWinnerId?: string,
    options?: { closeEditorOnSave?: boolean }
  ) => {
    if (isPending) return;
    const nextSavedKey = `${nextFirstScore}:${nextSecondScore}:${nextWinnerId ?? ""}`;
    if (nextSavedKey === lastSavedKey) return;

    setSaveState("saving");

    const formData = new FormData();
    formData.set("matchId", match.id);
    formData.set("status", "FINAL");
    if (nextWinnerId) formData.set("winnerParticipantId", nextWinnerId);
    if (nextFirstScore) formData.set("homeScore", nextFirstScore);
    if (nextSecondScore) formData.set("awayScore", nextSecondScore);
    void runAction(() => recordTournamentMatchResult(formData)).then((result) => {
      if (!result.success) {
        setSaveState("error");
        setSavedLabel(result.error ?? "Save failed");
        return;
      }
      setSaveState("saved");
      setLastSavedKey(nextSavedKey);
      setSavedLabel(nextFirstScore || nextSecondScore ? `Saved ${nextFirstScore}-${nextSecondScore}` : "Bye advanced");
      if (options?.closeEditorOnSave) setIsEditingFinalResult(false);
    });
  };

  const inferWinner = (nextFirstScore: string, nextSecondScore: string) => {
    if (!secondPlayer) return "";
    const parsedFirstScore = Number(nextFirstScore);
    const parsedSecondScore = Number(nextSecondScore);
    if (!Number.isInteger(parsedFirstScore) || !Number.isInteger(parsedSecondScore)) return "";
    if (parsedFirstScore === parsedSecondScore) return "";
    return parsedFirstScore > parsedSecondScore ? firstPlayer.id : secondPlayer.id;
  };

  const updateScores = (nextFirstScore: string, nextSecondScore: string) => {
    setFirstScore(nextFirstScore);
    setSecondScore(nextSecondScore);
    if (saveState !== "saving") {
      setSaveState("idle");
      setSavedLabel("");
    }
  };

  const saveIfReady = (nextFirstScore: string, nextSecondScore: string) => {
    const inferredWinnerId = inferWinner(nextFirstScore, nextSecondScore);
    if (!nextFirstScore || !nextSecondScore || !inferredWinnerId) return;
    saveResult(nextFirstScore, nextSecondScore, inferredWinnerId);
  };

  const currentWinnerId = inferWinner(firstScore, secondScore);
  const currentSavedKey = `${firstScore}:${secondScore}:${currentWinnerId}`;
  const hasScoreChange = currentSavedKey !== lastSavedKey;
  const canSaveScore = Boolean(firstScore && secondScore && currentWinnerId && (!isFinal || hasScoreChange));
  const resultHint = !firstScore || !secondScore
    ? "Enter both scores"
    : !currentWinnerId
      ? "Scores cannot tie"
      : isFinal && !hasScoreChange
        ? "Change scores to edit result"
      : isFinal
        ? "Save correction"
        : "Higher score advances";

  const saveCurrentScore = () => {
    const inferredWinnerId = inferWinner(firstScore, secondScore);
    if (!firstScore || !secondScore || !inferredWinnerId) {
      setSaveState("error");
      setSavedLabel(!firstScore || !secondScore ? "Enter both scores" : "Scores cannot tie");
      return;
    }
    saveResult(firstScore, secondScore, inferredWinnerId, { closeEditorOnSave: isFinal });
  };

  const cancelEdit = () => {
    setFirstScore(match.homeScore?.toString() ?? "");
    setSecondScore(match.awayScore?.toString() ?? "");
    setSaveState(initialSavedKey ? "saved" : "idle");
    setSavedLabel(initialSavedKey ? "Saved" : "");
    setLastSavedKey(initialSavedKey);
    setIsEditingFinalResult(false);
  };

  const stepScore = (side: "first" | "second", delta: number) => {
    const currentValue = side === "first" ? firstScore : secondScore;
    const parsedScore = Number.parseInt(currentValue || "0", 10);
    const nextScore = Math.max(0, (Number.isFinite(parsedScore) ? parsedScore : 0) + delta).toString();
    if (side === "first") {
      updateScores(nextScore, secondScore);
    } else {
      updateScores(firstScore, nextScore);
    }
  };

  const showScoreEditors = canManage && !!secondPlayer && showEditor;
  const showResultActions = canManage && !!secondPlayer && showEditor;

  return (
    <div
      className="relative flex items-center"
      style={{ gridRow: `${rowStart} / span ${rowSpan}` }}
    >
      {hasPreviousRound && (
        <>
          <div className="pointer-events-none absolute -left-4 top-1/2 hidden h-px w-4 bg-cyan-400/30 lg:block" />
          <div className="pointer-events-none absolute -left-4 top-1/4 hidden h-1/2 w-px bg-cyan-400/30 lg:block" />
        </>
      )}
      {hasNextRound && (
        <div className="pointer-events-none absolute -right-4 top-1/2 hidden h-px w-4 bg-cyan-400/30 lg:block" />
      )}
      <div className={cn(
        "relative w-full rounded-md border p-2 shadow-lg shadow-black/20",
        isFinal && "border-emerald-500/35 bg-emerald-950/20",
        isActive && "border-cyan-500/35 bg-cyan-950/20",
        isDisputed && "border-red-500/35 bg-red-950/20",
        !isFinal && !isActive && !isDisputed && "border-slate-800 bg-slate-900/70"
      )}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            M{match.matchNumber}
          </span>
          <div className="flex items-center gap-1">
            {canManage && isFinal && secondPlayer && !showEditor && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setIsEditingFinalResult(true)}
                className="h-6 w-6 text-slate-400 hover:text-slate-100"
                title="Edit result"
                aria-label="Edit result"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[9px]", matchStatusTone(match.status))}>
              {matchStatusLabels[match.status]}
            </Badge>
          </div>
        </div>
        <div className="space-y-1.5">
          <BracketPlayerRow
            participant={match.homeParticipant}
            fallbackName="TBD"
            score={match.homeScore}
            isWinner={match.winnerParticipantId === match.homeParticipantId}
            scoreSlot={showScoreEditors ? (
              <BracketScoreEditor
                label={firstPlayer.player.ingameName}
                value={firstScore}
                isWinner={currentWinnerId === firstPlayer.id}
                isPending={isPending}
                onChange={(value) => updateScores(value, secondScore)}
                onCommit={() => {
                  if (!isFinal) saveIfReady(firstScore, secondScore);
                }}
                onStep={(delta) => stepScore("first", delta)}
              />
            ) : undefined}
          />
          <BracketPlayerRow
            participant={match.awayParticipant}
            fallbackName={waitingForOpponent ? "TBD" : "Bye"}
            score={match.awayScore}
            isWinner={match.winnerParticipantId === match.awayParticipantId}
            isBye={!match.awayParticipant && !waitingForOpponent}
            scoreSlot={showScoreEditors && secondPlayer ? (
              <BracketScoreEditor
                label={secondPlayer.player.ingameName}
                value={secondScore}
                isWinner={currentWinnerId === secondPlayer.id}
                isPending={isPending}
                onChange={(value) => updateScores(firstScore, value)}
                onCommit={() => {
                  if (!isFinal) saveIfReady(firstScore, secondScore);
                }}
                onStep={(delta) => stepScore("second", delta)}
              />
            ) : undefined}
          />
        </div>
        {winnerParticipant && (!canManage || !isFinal) && (
          <div className="mt-2 flex items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-200">
            <Crown className="h-3 w-3" />
            <SummonerLink
              player={winnerParticipant.player}
              className="text-emerald-200 hover:text-emerald-100"
              avatarClassName="h-4 w-4"
            />
          </div>
        )}
        {canManage && !secondPlayer && !isFinal && (
          <div className="mt-2 border-t border-slate-800 pt-2">
            {waitingForOpponent ? (
              <p className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-center text-xs font-semibold text-slate-500">
                Waiting for opponent
              </p>
            ) : (
              <Button
                disabled={isPending}
                size="sm"
                onClick={() => saveResult("", "", firstPlayer.id)}
                className="h-8 w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" />
                Advance bye
              </Button>
            )}
          </div>
        )}
        {showResultActions && (
          <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2 border-t border-slate-800 pt-2">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {resultHint}
            </p>
            <div className="flex justify-end gap-1">
              {isFinal && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={cancelEdit}
                  className="h-7 w-7 text-slate-500 hover:text-slate-200"
                  title="Cancel edit"
                  aria-label="Cancel edit"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={isPending || !canSaveScore}
                onMouseDown={(event) => event.preventDefault()}
                onClick={saveCurrentScore}
                className="h-7 px-2 text-[11px]"
                variant="outline"
              >
                Save
              </Button>
            </div>
          </div>
        )}
        {saveState !== "idle" && (
          <p className={cn(
            "mt-1 text-center text-[11px] font-semibold uppercase tracking-wide",
            saveState === "saving" && "text-cyan-300",
            saveState === "saved" && "text-emerald-300",
            saveState === "error" && "text-red-300"
          )}>
            {saveState === "saving" ? "Saving" : saveState === "saved" ? savedLabel : savedLabel || "Save failed"}
          </p>
        )}
        {canManage && !secondPlayer && isFinal && (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-800 pt-2">
            <p className="truncate text-xs font-semibold text-slate-300">
              {firstPlayer.player.ingameName} advanced by bye
            </p>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          </div>
        )}
      </div>
    </div>
  );
}

function BracketFlow({
  tournament,
  canManage,
  isPending,
  runAction,
}: {
  tournament: TournamentSummary;
  canManage: boolean;
  isPending: boolean;
  runAction: RunTournamentAction;
}) {
  const rounds = groupMatchesByRound(tournament);
  const singleEliminationRounds = tournament.format === "SINGLE_ELIMINATION"
    ? buildSingleEliminationSlots(tournament)
    : null;
  const visualRounds = singleEliminationRounds ?? rounds.map(([round, matches]) => ({
    round,
    slots: matches.map((match) => ({ matchNumber: match.matchNumber, match })),
  }));
  const bracketSize = singleEliminationRounds
    ? Math.max(2, nextPowerOfTwo(tournament.participants.length))
    : Math.max(2, Math.max(...rounds.map(([, matches]) => matches.length), 1) * 2);
  const completedMatches = tournament.matches.filter((match) => match.status === "FINAL").length;
  const activeMatches = tournament.matches.filter((match) => match.status === "PLAYING" || match.status === "REPORTED").length;
  const finalRound = rounds.at(-1)?.[1] ?? [];
  const champion = finalRound.length === 1 && finalRound[0].status === "FINAL"
    ? finalRound[0].winnerParticipant?.player.ingameName
    : null;

  if (visualRounds.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-950/80">
      <div className="flex flex-col gap-3 border-b border-slate-800 bg-cyan-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-cyan-300" />
            <h3 className="font-bold text-white">Bracket</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {completedMatches} final / {activeMatches} active / {tournament.matches.length} total
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
          {champion ? `Champion: ${champion}` : `${visualRounds.length} rounds`}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-max grid-flow-col auto-cols-[minmax(165px,185px)] gap-8 p-4"
          style={{ minHeight: `${bracketSize * 58 + 48}px` }}
        >
          {visualRounds.map(({ round, slots }, roundIndex) => (
            <div
              key={round}
              className="grid gap-y-1"
              style={{ gridTemplateRows: `repeat(${bracketSize + 2}, minmax(26px, 1fr))` }}
            >
              <div className="sticky left-0 z-10 row-start-1 h-fit rounded-md border border-slate-800 bg-slate-950 px-2 py-1">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Round {round}
                </p>
                <p className="text-xs font-semibold text-slate-200">
                  {slots.length} {slots.length === 1 ? "fight" : "fights"}
                </p>
              </div>

              {slots.map((slot, slotIndex) => {
                const match = slot.match;
                const rowSpan = 2 ** (roundIndex + 1);
                const rowStart = slotIndex * rowSpan + 3;
                const hasPreviousRound = roundIndex > 0;
                const hasNextRound = roundIndex < visualRounds.length - 1;

                if (!match) {
                  const firstFeeder = slot.matchNumber * 2 - 1;
                  const secondFeeder = slot.matchNumber * 2;
                  return (
                    <div
                      key={`${round}:${slot.matchNumber}`}
                      className="relative flex items-center"
                      style={{ gridRow: `${rowStart} / span ${rowSpan}` }}
                    >
                      {hasPreviousRound && (
                        <>
                          <div className="pointer-events-none absolute -left-4 top-1/2 hidden h-px w-4 bg-slate-700 lg:block" />
                          <div className="pointer-events-none absolute -left-4 top-1/4 hidden h-1/2 w-px bg-slate-700 lg:block" />
                        </>
                      )}
                      {hasNextRound && (
                        <div className="pointer-events-none absolute -right-4 top-1/2 hidden h-px w-4 bg-slate-700 lg:block" />
                      )}
                      <div className="w-full rounded-md border border-dashed border-slate-800 bg-slate-950/60 p-2 text-xs text-slate-600">
                        <p className="font-bold uppercase tracking-widest">M{slot.matchNumber}</p>
                        <p className="mt-1">Winner of M{firstFeeder} / M{secondFeeder}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <BracketMatchCard
                    key={match.id}
                    tournament={tournament}
                    match={match}
                    canManage={canManage}
                    isPending={isPending}
                    runAction={runAction}
                    rowStart={rowStart}
                    rowSpan={rowSpan}
                    hasPreviousRound={hasPreviousRound}
                    hasNextRound={hasNextRound}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BattlegroundsTournamentsClient({
  allianceName,
  currentPlayerId,
  bgColors,
  players,
  tournaments,
  canCreate,
  manageableTournamentIds,
  showTournamentQueue = true,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTournamentId, setSelectedTournamentId] = useState(tournaments[0]?.id ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedTournament = tournaments.find((tournament) => tournament.id === selectedTournamentId) ?? tournaments[0] ?? null;
  const manageableTournamentIdSet = useMemo(
    () => new Set(manageableTournamentIds),
    [manageableTournamentIds]
  );

  const availableMembers = useMemo(() => {
    const participantIds = new Set(selectedTournament?.participants.map((entry) => entry.player.id) ?? []);
    return players
      .filter((member) => !participantIds.has(member.id))
      .filter((member) => selectedTournament?.scope !== "ALLIANCE" || member.allianceId === selectedTournament.allianceId)
      .sort((a, b) => {
        const aBg = a.battlegroup ?? 99;
        const bBg = b.battlegroup ?? 99;
        if (aBg !== bBg) return aBg - bBg;
        return a.ingameName.localeCompare(b.ingameName);
      });
  }, [players, selectedTournament]);

  const runAction = (action: () => Promise<TournamentActionResult>) => {
    setMessage(null);
    return new Promise<TournamentActionResult>((resolve) => {
      startTransition(async () => {
        const result = await action();
        if (!result.success) {
          setMessage(result.error);
          resolve(result);
          return;
        }
        router.refresh();
        resolve(result);
      });
    });
  };

  const participants = selectedTournament ? sortParticipants(selectedTournament) : [];
  const currentUserEntry = participants.find((entry) => entry.player.id === currentPlayerId) ?? null;
  const isCurrentUserEntered = !!currentUserEntry;
  const canManageSelected = !!selectedTournament && (
    manageableTournamentIdSet.has(selectedTournament.id) ||
    selectedTournament.createdById === currentPlayerId
  );
  const canJoinSelected = !!selectedTournament &&
    !isCurrentUserEntered &&
    ["REGISTRATION", "CHECK_IN"].includes(selectedTournament.status);
  const canCheckInSelected = !!selectedTournament &&
    !!currentUserEntry &&
    currentUserEntry.status !== "CHECKED_IN" &&
    selectedTournament.status === "CHECK_IN";
  const checkedInCount = participants.filter((entry) => entry.status === "CHECKED_IN").length;
  const supportsStartSelected = selectedTournament?.format === "SINGLE_ELIMINATION";
  const hasFightsSelected = (selectedTournament?.matches.length ?? 0) > 0;
  const canStartSelected = !!selectedTournament &&
    !!supportsStartSelected &&
    participants.length >= 2 &&
    (selectedTournament.status !== "LIVE" || !hasFightsSelected);
  const lifecycleAction = selectedTournament
    ? selectedTournament.status === "LIVE" && !hasFightsSelected
      ? null
      : nextLifecycleAction(selectedTournament.status, !!supportsStartSelected)
    : null;
  const bgCounts = [1, 2, 3].map((bg) => ({
    bg,
    count: participants.filter((entry) => entry.battlegroup === bg).length,
  }));
  const standings = selectedTournament ? buildStandings(selectedTournament) : [];
  const matchRounds = selectedTournament ? groupMatchesByRound(selectedTournament) : [];
  const summonerGuidance = selectedTournament ? summonerCountGuidance(selectedTournament) : null;
  const nextManualRound = selectedTournament
    ? Math.max(1, ...selectedTournament.matches.map((match) => match.round))
    : 1;
  const nextManualMatchNumber = selectedTournament
    ? selectedTournament.matches.filter((match) => match.round === nextManualRound).length + 1
    : 1;

  return (
    <div className="space-y-5">
      {message && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {message}
        </div>
      )}

      <div className={cn("grid grid-cols-1 gap-6", showTournamentQueue && "xl:grid-cols-[360px_1fr]")}>
        {showTournamentQueue && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Tournament Queue</h2>
              <p className="text-xs text-slate-500">{allianceName}</p>
            </div>
            {canCreate && (
              <Button asChild className="gap-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                <Link href="/battlegrounds/tournaments/new">
                  <Plus className="h-4 w-4" />
                  Create
                </Link>
              </Button>
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
        )}

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
                      {canCheckInSelected && (
                        <Button
                          disabled={isPending}
                          onClick={() => runAction(() => checkInTournamentParticipant(selectedTournament.id))}
                          className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Check in
                        </Button>
                      )}
                      {canManageSelected && canStartSelected && (
                        <Button
                          disabled={isPending}
                          onClick={() => runAction(() => startTournament(selectedTournament.id))}
                          className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                        >
                          <Swords className="h-4 w-4" />
                          Start tournament
                        </Button>
                      )}
                      {canManageSelected && lifecycleAction && (
                        <Button
                          disabled={isPending}
                          variant="outline"
                          onClick={() => {
                            void runAction(() => updateTournamentStatus(selectedTournament.id, lifecycleAction.status));
                          }}
                          className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
                        >
                          {lifecycleAction.label}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-b border-slate-800 md:grid-cols-4">
                  <div className="border-b border-r border-slate-800 p-4 md:border-b-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Start</p>
                    <p className="mt-1 font-semibold text-slate-200">{formatDate(selectedTournament.startsAt)}</p>
                  </div>
                  <div className="border-b border-slate-800 p-4 md:border-b-0 md:border-r">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Check-in</p>
                    <p className="mt-1 font-semibold text-slate-200">{formatDate(selectedTournament.checkInStartsAt)}</p>
                  </div>
                  <div className="border-r border-slate-800 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Summoners</p>
                    <p className="mt-1 font-semibold text-slate-200">{participants.length} total</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Matches</p>
                    <p className="mt-1 font-semibold text-slate-200">{selectedTournament.matches.length} scheduled</p>
                  </div>
                </div>

                <Tabs defaultValue={showTournamentQueue || selectedTournament.matches.length === 0 ? "entrants" : "matches"} className="w-full">
                  <div className="border-b border-slate-800 px-4 pt-4">
                    <TabsList className="grid h-auto w-full grid-cols-3 bg-slate-900/80 p-1 text-slate-400 sm:w-fit">
                      <TabsTrigger value="entrants" className="gap-2 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-950">
                        <Users className="h-4 w-4" />
                        Summoners
                      </TabsTrigger>
                      <TabsTrigger value="matches" className="gap-2 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-950">
                        <Swords className="h-4 w-4" />
                        Matches
                      </TabsTrigger>
                      <TabsTrigger value="standings" className="gap-2 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-950">
                        <Trophy className="h-4 w-4" />
                        Standings
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="entrants" className="m-0">
                    <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap gap-2">
                        {bgCounts.map(({ bg, count }) => (
                          <span key={bg} className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-300">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: bgColors[bg] }} />
                            BG{bg}: {count}
                          </span>
                        ))}
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {checkedInCount} checked in
                        </span>
                        {summonerGuidance && (
                          <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold", summonerGuidance.tone)}>
                            {summonerGuidance.text}
                          </span>
                        )}
                      </div>
                    </div>

                    {canManageSelected && (
                      <form
                        className="grid grid-cols-1 gap-3 border-b border-slate-800 p-4 lg:grid-cols-[1fr_90px_150px_auto]"
                        action={(formData) => {
                          void runAction(() => addTournamentParticipant(formData));
                        }}
                      >
                        <input type="hidden" name="tournamentId" value={selectedTournament.id} />
                        <select name="playerId" className="h-9 rounded-md border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100">
                          <option value="">Add summoner...</option>
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
                        <th className="px-4 py-3 text-left">Summoner</th>
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
                            No summoners yet. Add alliance members to shape the field.
                          </td>
                        </tr>
                      )}
                      {participants.map((entry) => (
                        <tr key={entry.id} className="border-b border-slate-900/80">
                          <td className="px-4 py-3 font-mono font-bold text-slate-300">{entry.seed ?? "-"}</td>
                          <td className="px-4 py-3">
                            <SummonerLink
                              player={entry.player}
                              className="font-semibold text-slate-200"
                              avatarClassName="h-8 w-8"
                            />
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
                  </TabsContent>

                  <TabsContent value="standings" className="m-0 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white">Standings</h3>
                        <p className="text-sm text-slate-500">Wins, differential, seed</p>
                      </div>
                      <Badge variant="outline" className="border-slate-700 text-slate-400">
                        {selectedTournament.matches.filter((match) => match.status === "FINAL").length} final
                      </Badge>
                    </div>
                    <div className="mt-4 space-y-2">
                      {standings.length === 0 && (
                        <p className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                          Add participants and matches to build standings.
                        </p>
                      )}
                      {standings.map((standing, index) => (
                        <div key={standing.participant.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                              <span className="shrink-0 text-slate-500">#{index + 1}</span>
                              <SummonerLink
                                player={standing.participant.player}
                                className="min-w-0 text-slate-200"
                                avatarClassName="h-6 w-6"
                              />
                            </div>
                            <p className="text-xs text-slate-500">
                              {standing.participant.battlegroup ? `BG${standing.participant.battlegroup}` : "Community"} · seed {standing.participant.seed ?? "-"}
                            </p>
                          </div>
                          <div className="text-right font-mono text-sm text-slate-300">
                            <p>{standing.wins}-{standing.losses}</p>
                            <p className="text-xs text-slate-500">
                              {standing.pointsFor - standing.pointsAgainst >= 0 ? "+" : ""}{standing.pointsFor - standing.pointsAgainst}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="matches" className="m-0 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="font-bold text-white">Matches</h3>
                        <p className="text-sm text-slate-500">{matchRounds.length} rounds</p>
                      </div>
                      {canManageSelected && canStartSelected && (
                        <Button
                          disabled={isPending}
                          onClick={() => runAction(() => startTournament(selectedTournament.id))}
                          className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                        >
                          <Swords className="h-4 w-4" />
                          Start tournament
                        </Button>
                      )}
                    </div>
                    {canManageSelected && !supportsStartSelected && (
                      <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                        Automated start is currently available for single elimination. Add pairings manually for this format.
                      </div>
                    )}

                    {matchRounds.length > 0 && (
                      <div className="mt-5">
                        <BracketFlow
                          tournament={selectedTournament}
                          canManage={canManageSelected}
                          isPending={isPending}
                          runAction={runAction}
                        />
                      </div>
                    )}

                    {canManageSelected && (
                      <form
                        className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 lg:grid-cols-[80px_80px_1fr_1fr_auto]"
                        action={(formData) => {
                          void runAction(() => createTournamentMatch(formData));
                        }}
                      >
                        <input type="hidden" name="tournamentId" value={selectedTournament.id} />
                        <Input name="round" inputMode="numeric" defaultValue={nextManualRound} aria-label="Round" className="border-slate-800 bg-slate-900" />
                        <Input name="matchNumber" inputMode="numeric" defaultValue={nextManualMatchNumber} aria-label="Fight number" className="border-slate-800 bg-slate-900" />
                        <select name="homeParticipantId" aria-label="First fighter" className="h-9 rounded-md border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100">
                          <option value="">First fighter...</option>
                          {participants.map((entry) => (
                            <option key={entry.id} value={entry.id}>{entry.player.ingameName}</option>
                          ))}
                        </select>
                        <select name="awayParticipantId" aria-label="Second fighter" className="h-9 rounded-md border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100">
                          <option value="">Second fighter / bye...</option>
                          {participants.map((entry) => (
                            <option key={entry.id} value={entry.id}>{entry.player.ingameName}</option>
                          ))}
                        </select>
                        <Button disabled={isPending} className="bg-slate-100 text-slate-950 hover:bg-white">
                          <Plus className="h-4 w-4" />
                          Add match
                        </Button>
                      </form>
                    )}

                    <div className="mt-5 space-y-3">
                      {matchRounds.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center">
                          <Swords className="mx-auto h-8 w-8 text-slate-700" />
                          <p className="mt-2 font-semibold text-slate-300">No matches yet</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Start the tournament when the summoner list is ready, or add pairings manually.
                          </p>
                        </div>
                      )}

                      {matchRounds.length > 0 && (
                        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
                          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Match log</p>
                            <Badge variant="outline" className="border-slate-700 text-slate-400">
                              {selectedTournament.matches.length} total
                            </Badge>
                          </div>
                          <div className="divide-y divide-slate-800">
                            {matchRounds.flatMap(([round, matches]) => matches.map((match) => (
                              <div key={match.id} className="grid gap-3 px-3 py-2 text-sm md:grid-cols-[90px_1fr_88px_auto] md:items-center">
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                  <span>R{round}</span>
                                  <span>M{match.matchNumber}</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                                    <div className={cn("min-w-0 font-semibold", match.winnerParticipantId === match.homeParticipantId ? "text-emerald-300" : "text-slate-200")}>
                                      {match.homeParticipant ? (
                                        <SummonerLink
                                          player={match.homeParticipant.player}
                                          className={match.winnerParticipantId === match.homeParticipantId ? "text-emerald-300" : "text-slate-200"}
                                          avatarClassName="h-5 w-5"
                                        />
                                      ) : (
                                        <span className="truncate">TBD</span>
                                      )}
                                    </div>
                                    <p className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-center font-mono text-xs text-slate-400">
                                      {match.homeScore ?? "--"} : {match.awayScore ?? "--"}
                                    </p>
                                    <div className={cn("flex min-w-0 justify-end font-semibold", match.winnerParticipantId === match.awayParticipantId ? "text-emerald-300" : "text-slate-200")}>
                                      {match.awayParticipant ? (
                                        <SummonerLink
                                          player={match.awayParticipant.player}
                                          className={match.winnerParticipantId === match.awayParticipantId ? "text-emerald-300" : "text-slate-200"}
                                          avatarClassName="h-5 w-5"
                                        />
                                      ) : (
                                        <span className="truncate">Bye</span>
                                      )}
                                    </div>
                                  </div>
                                  {match.notes && <p className="mt-1 truncate text-xs text-slate-500">{match.notes}</p>}
                                </div>
                                <Badge variant="outline" className={cn("w-fit text-[10px]", matchStatusTone(match.status))}>
                                  {matchStatusLabels[match.status]}
                                </Badge>

                                {canManageSelected ? (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    disabled={isPending}
                                    onClick={() => runAction(() => deleteTournamentMatch(match.id))}
                                    className="h-8 w-8 justify-self-end text-slate-500 hover:bg-red-950/30 hover:text-red-300"
                                    aria-label={`Delete round ${round} match ${match.matchNumber}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <div />
                                )}
                              </div>
                            )))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
