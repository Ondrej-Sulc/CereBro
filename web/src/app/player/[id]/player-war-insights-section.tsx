"use client";

import { ComponentType, CSSProperties, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, MapPinned, Shield, Skull, Swords, Target, Trophy } from "lucide-react";
import {
  PlayerWarAttackerInsight,
  PlayerWarInsights,
  PlayerWarNodeGroupInsight,
} from "@/lib/player-war-insights";
import { ChampionAvatar } from "@/components/champion-avatar";
import { Badge } from "@/components/ui/badge";
import { getChampionClassColors } from "@/lib/championClassHelper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PlayerWarInsightsSectionProps {
  playerName: string;
  insights: PlayerWarInsights;
}

export function PlayerWarInsightsSection({
  playerName,
  insights,
}: PlayerWarInsightsSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedValue = insights.scope.type === "season" ? String(insights.scope.season) : "all";
  const scopeLabel = insights.scope.type === "season" ? `Season ${insights.scope.season}` : "All seasons";
  const hasData = insights.totalFights > 0;

  const handleScopeChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("warSeason");
    } else {
      params.set("warSeason", value);
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-amber-500" />
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-amber-400">
            Alliance War Insights
          </h2>
          <Badge variant="outline" className="border-slate-800 bg-slate-950/50 text-[10px] font-black uppercase text-slate-400">
            {scopeLabel}
          </Badge>
        </div>

        <Select value={selectedValue} onValueChange={handleScopeChange} disabled={isPending}>
          <SelectTrigger className="h-9 w-full border-slate-800 bg-slate-900/80 text-xs font-black uppercase text-slate-300 sm:w-[160px]">
            <SelectValue placeholder="War scope" />
          </SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
            <SelectItem value="all">All seasons</SelectItem>
            {insights.availableSeasons.map((season) => (
              <SelectItem key={season} value={String(season)}>
                Season {season}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <InsightStat icon={Trophy} label="Scope" value={scopeLabel} tone="amber" />
        <InsightStat icon={Shield} label="Wars" value={insights.totalWars.toLocaleString()} tone="slate" />
        <InsightStat icon={Swords} label="Fights" value={insights.totalFights.toLocaleString()} tone="sky" />
        <InsightStat
          icon={BarChart3}
          label="Solo Rate"
          value={`${insights.soloRate.toFixed(1)}%`}
          tone={insights.soloRate >= 80 ? "emerald" : insights.soloRate >= 60 ? "amber" : "red"}
        />
        <InsightStat icon={Skull} label="Deaths" value={insights.totalDeaths.toLocaleString()} tone="red" />
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800/60 bg-slate-950/40 p-8 text-center">
          <Target className="mb-2 h-8 w-8 text-slate-700" />
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            No alliance-war fights recorded for this scope
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RouteUsagePanel
            routes={insights.topNodeGroups}
            playerName={playerName}
            totalFights={insights.totalFights}
          />
          <AttackerUsagePanel
            attackers={insights.topAttackers}
            playerName={playerName}
            totalFights={insights.totalFights}
          />
        </div>
      )}
    </section>
  );
}

function InsightStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "amber" | "emerald" | "red" | "sky" | "slate";
}) {
  const toneClasses = {
    amber: "border-amber-900/30 bg-amber-950/20 text-amber-300",
    emerald: "border-emerald-900/30 bg-emerald-950/20 text-emerald-300",
    red: "border-red-900/30 bg-red-950/20 text-red-300",
    sky: "border-sky-900/30 bg-sky-950/20 text-sky-300",
    slate: "border-slate-800/60 bg-slate-900/40 text-slate-300",
  }[tone];

  return (
    <div className={cn("rounded-xl border p-4", toneClasses)}>
      <div className="mb-2 flex items-center gap-1.5 opacity-80">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <div className="truncate font-mono text-2xl font-black leading-none">{value}</div>
    </div>
  );
}

function RouteUsagePanel({
  routes,
  playerName,
  totalFights,
}: {
  routes: PlayerWarNodeGroupInsight[];
  playerName: string;
  totalFights: number;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
      <InsightPanelHeader
        icon={MapPinned}
        title="Most Common Routes"
        accentClassName="text-amber-400"
        count={routes.length}
      />

      {routes.length === 0 ? (
        <EmptyPanel label={`${playerName} has no recorded route data.`} />
      ) : (
        <div className="space-y-3">
          {routes.map((route, index) => (
            <div
              key={route.key}
              className="rounded-lg border border-slate-800/50 bg-slate-950/60 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-300">
                  <span className="text-[9px] font-black uppercase text-amber-500/70">#{index + 1}</span>
                  <span className="font-mono text-sm font-black leading-none">{formatRouteCode(route)}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black uppercase tracking-tight text-slate-200">
                        {route.label}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {formatCategory(route.category)} · Nodes {formatNodeList(route.nodeNumbers)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-xl font-black leading-none text-amber-300">
                        {route.fights}
                      </div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                        Fights
                      </div>
                    </div>
                  </div>

                  <UsageBar
                    value={route.fights}
                    total={totalFights}
                    className="mt-3 bg-amber-500"
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <MiniMetric label="Solo" value={`${route.soloRate.toFixed(1)}%`} tone="emerald" />
                    <MiniMetric label="Deaths" value={route.deaths.toLocaleString()} tone="red" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttackerUsagePanel({
  attackers,
  playerName,
  totalFights,
}: {
  attackers: PlayerWarAttackerInsight[];
  playerName: string;
  totalFights: number;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
      <InsightPanelHeader
        icon={Swords}
        title="Most Used Attackers"
        accentClassName="text-sky-400"
        count={attackers.length}
      />

      {attackers.length === 0 ? (
        <EmptyPanel label={`${playerName} has no recorded attacker data.`} />
      ) : (
        <div className="space-y-3">
          {attackers.map((attacker, index) => {
            const classColors = getChampionClassColors(attacker.class);
            return (
              <div
                key={attacker.championId}
                className="rounded-lg border border-slate-800/50 bg-slate-950/60 p-3"
                style={{ borderLeftColor: index < 3 ? `${classColors.color}80` : undefined, borderLeftWidth: index < 3 ? 3 : undefined }}
              >
                <div className="flex items-center gap-3">
                  <ChampionAvatar
                    name={attacker.name}
                    images={attacker.images}
                    championClass={attacker.class}
                    size="md"
                    showStars={false}
                    showRank={false}
                    className="h-12 w-12"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black uppercase tracking-tight text-slate-200">
                          {attacker.name}
                        </div>
                        <div className={cn("mt-0.5 text-[10px] font-black uppercase tracking-wider", classColors.text)}>
                          {attacker.class}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-xl font-black leading-none text-sky-300">
                          {attacker.fights}
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                          Fights
                        </div>
                      </div>
                    </div>

                    <UsageBar
                      value={attacker.fights}
                      total={totalFights}
                      className="mt-3"
                      style={{ backgroundColor: classColors.color }}
                    />

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <MiniMetric label="Solo" value={`${attacker.soloRate.toFixed(1)}%`} tone="emerald" />
                      <MiniMetric label="Deaths" value={attacker.deaths.toLocaleString()} tone="red" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InsightPanelHeader({
  icon: Icon,
  title,
  accentClassName,
  count,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  accentClassName: string;
  count: number;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", accentClassName)} />
        <h3 className="truncate text-xs font-black uppercase tracking-[0.18em] text-slate-300">
          {title}
        </h3>
      </div>
      <Badge variant="outline" className="border-slate-800 bg-slate-950/60 text-[9px] font-black uppercase text-slate-500">
        Top {count}
      </Badge>
    </div>
  );
}

function UsageBar({
  value,
  total,
  className,
  style,
}: {
  value: number;
  total: number;
  className?: string;
  style?: CSSProperties;
}) {
  const percent = total > 0 ? Math.min(100, (value / total) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-900">
        <div
          className={cn("h-full rounded-full", className)}
          style={{
            width: `${value > 0 ? Math.max(6, percent) : 0}%`,
            ...style,
          }}
        />
      </div>
      <span className="w-10 text-right font-mono text-[10px] font-black text-slate-500">
        {percent.toFixed(0)}%
      </span>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "red";
}) {
  const toneClass = tone === "emerald"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
    : "border-red-500/20 bg-red-500/10 text-red-300";

  return (
    <span className={cn("rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", toneClass)}>
      {label} {value}
    </span>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
      {label}
    </div>
  );
}

function formatCategory(category: PlayerWarNodeGroupInsight["category"]) {
  if (category === "mini-boss") return "Mini-boss";
  if (category === "boss") return "Boss";
  return "Path";
}

function formatNodeList(nodeNumbers: number[]) {
  if (nodeNumbers.length <= 4) return nodeNumbers.join(", ");
  return `${nodeNumbers.slice(0, 4).join(", ")} +${nodeNumbers.length - 4}`;
}

function formatRouteCode(route: PlayerWarNodeGroupInsight) {
  if (route.category === "boss") return "B";
  if (route.category === "mini-boss") return "MB";
  return route.label.replace(/\s+/g, "");
}
