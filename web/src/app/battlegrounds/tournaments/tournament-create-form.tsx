"use client";

import { useState, useTransition } from "react";
import {
  BattlegroundsTournamentFormat,
  BattlegroundsTournamentScope,
} from "@prisma/client";
import { ArrowLeft, CalendarClock, CheckCircle2, Plus, Shield, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createTournament } from "./actions";
import {
  formatBadges,
  formatDescriptions,
  formatLabels,
  scopeDescriptions,
  scopeLabels,
} from "./tournament-labels";

type Props = {
  allianceName: string;
  hasAlliance: boolean;
};

type StartMode = "now" | "scheduled";

function appendTimezoneOffset(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value) return;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return;

  formData.set(`${key}TimezoneOffsetMinutes`, String(date.getTimezoneOffset()));
}

function toDatetimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function FormatPreview({ format }: { format: BattlegroundsTournamentFormat }) {
  if (format === "ROUND_ROBIN") {
    return (
      <div className="grid h-16 w-24 grid-cols-4 grid-rows-4 gap-1">
        {Array.from({ length: 16 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "rounded-sm border border-slate-700",
              index % 5 === 0 ? "bg-slate-800" : "bg-cyan-500/20"
            )}
          />
        ))}
      </div>
    );
  }

  if (format === "SWISS" || format === "SWISS_TOP_CUT") {
    return (
      <div className="flex h-16 w-24 flex-col justify-center gap-1.5">
        {[0, 1, 2].map((round) => (
          <div key={round} className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((pairing) => (
              <span key={pairing} className="h-3 rounded-sm border border-slate-700 bg-amber-500/20" />
            ))}
          </div>
        ))}
        {format === "SWISS_TOP_CUT" && (
          <div className="mx-auto mt-0.5 h-3 w-10 rounded-sm border border-emerald-500/40 bg-emerald-500/20" />
        )}
      </div>
    );
  }

  if (format === "LADDER") {
    return (
      <div className="flex h-16 w-24 items-end justify-center gap-1.5">
        {[24, 34, 44, 54].map((height, index) => (
          <span
            key={height}
            className={cn(
              "w-4 rounded-sm border border-slate-700 bg-violet-500/20",
              index === 3 && "bg-emerald-500/20"
            )}
            style={{ height }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid h-16 w-24 grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="space-y-1">
        {[0, 1, 2, 3].map((seed) => (
          <span key={seed} className="block h-2.5 rounded-sm border border-slate-700 bg-cyan-500/20" />
        ))}
      </div>
      <div className="h-10 w-px bg-slate-700" />
      <div className="space-y-2">
        <span className="block h-3 rounded-sm border border-slate-700 bg-emerald-500/20" />
        <span className="block h-3 rounded-sm border border-slate-700 bg-emerald-500/20" />
        {format === "DOUBLE_ELIMINATION" && (
          <span className="block h-2 rounded-sm border border-amber-500/40 bg-amber-500/20" />
        )}
      </div>
    </div>
  );
}

export function TournamentCreateForm({ allianceName, hasAlliance }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [format, setFormat] = useState<BattlegroundsTournamentFormat>("SINGLE_ELIMINATION");
  const [scope, setScope] = useState<BattlegroundsTournamentScope>(hasAlliance ? "ALLIANCE" : "COMMUNITY");
  const [startMode, setStartMode] = useState<StartMode>("now");
  const scopeOptions = ["COMMUNITY", ...(hasAlliance ? ["ALLIANCE"] : [])] as BattlegroundsTournamentScope[];

  return (
    <form
      className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"
      action={(formData) => {
        setMessage(null);
        if (startMode === "now") {
          formData.set("startsAt", toDatetimeLocalValue(new Date()));
          formData.delete("checkInStartsAt");
        }
        appendTimezoneOffset(formData, "startsAt");
        appendTimezoneOffset(formData, "checkInStartsAt");
        startTransition(async () => {
          const result = await createTournament(formData);
          if (!result.success) {
            setMessage(result.error);
            return;
          }

          router.push("/battlegrounds/tournaments");
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="format" value={format} />

      <div className="space-y-6">
        {message && (
          <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {message}
          </div>
        )}

        <Card className="border-slate-800 bg-slate-950/70 p-5">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-cyan-300" />
            <h2 className="font-bold text-white">Basics</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Friday BG Gauntlet" className="border-slate-800 bg-slate-900" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Organizer notes</Label>
              <Textarea id="description" name="description" placeholder="Rules, deck limits, rewards, stream notes..." className="min-h-28 border-slate-800 bg-slate-900" />
            </div>
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70 p-5">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan-300" />
            <h2 className="font-bold text-white">Access</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {scopeOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setScope(option)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  scope === option
                    ? "border-cyan-500/50 bg-cyan-500/10"
                    : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                )}
              >
                <span className="font-semibold text-slate-100">{scopeLabels[option]}</span>
                <span className="mt-1 block text-sm leading-6 text-slate-500">{scopeDescriptions[option]}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70 p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-300" />
            <h2 className="font-bold text-white">Format</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Object.values(BattlegroundsTournamentFormat).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFormat(option)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  format === option
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                )}
              >
                <div className="flex gap-4">
                  <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-950/70">
                    <FormatPreview format={option} />
                  </div>
                  <div className="min-w-0">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-100">{formatLabels[option]}</span>
                      <span className="shrink-0 rounded-md border border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
                        {formatBadges[option]}
                      </span>
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-slate-500">{formatDescriptions[option]}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70 p-5">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-cyan-300" />
            <h2 className="font-bold text-white">Schedule</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([
              { value: "now", title: "Start now", detail: "Use the current time as the tournament start." },
              { value: "scheduled", title: "Schedule", detail: "Choose start and check-in times." },
            ] as Array<{ value: StartMode; title: string; detail: string }>).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStartMode(option.value)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  startMode === option.value
                    ? "border-cyan-500/50 bg-cyan-500/10"
                    : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                )}
              >
                <span className="font-semibold text-slate-100">{option.title}</span>
                <span className="mt-1 block text-sm leading-6 text-slate-500">{option.detail}</span>
              </button>
            ))}
          </div>

          {startMode === "scheduled" && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Start time</Label>
                <Input id="startsAt" name="startsAt" type="datetime-local" className="border-slate-800 bg-slate-900" />
                <p className="text-xs leading-5 text-slate-500">Saved using your device timezone.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkInStartsAt">Check-in opens</Label>
                <Input id="checkInStartsAt" name="checkInStartsAt" type="datetime-local" className="border-slate-800 bg-slate-900" />
                <p className="text-xs leading-5 text-slate-500">Summoners see this in local time.</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <Card className="border-slate-800 bg-slate-950/80 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Summary</p>
          <h2 className="mt-2 text-xl font-black text-white">Create draft</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Access</span>
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                {scopeLabels[scope]}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Format</span>
              <span className="font-semibold text-slate-200">{formatLabels[format]}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Alliance</span>
              <span className="max-w-40 truncate font-semibold text-slate-200">{allianceName}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Initial status</span>
              <span className="font-semibold text-slate-200">Draft</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Start</span>
              <span className="font-semibold text-slate-200">
                {startMode === "now" ? "Now" : "Scheduled"}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button disabled={isPending} className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              <Plus className="h-4 w-4" />
              Create draft
            </Button>
            <Button asChild variant="ghost" className="w-full text-slate-400 hover:bg-slate-900 hover:text-slate-100">
              <Link href="/battlegrounds/tournaments">
                <ArrowLeft className="h-4 w-4" />
                Back to tournaments
              </Link>
            </Button>
          </div>

          <div className="mt-5 flex items-start gap-2 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
            Drafts can be opened for registration from the tournament workspace.
          </div>
        </Card>
      </aside>
    </form>
  );
}
