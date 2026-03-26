"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const MAX_HISTORY_BARS = 4;
const MILESTONES = [25, 50, 75, 100] as const;

type Props = {
  coveredMinor: number;
  targetMinor: number;
  previewMinor?: number;
};

type BarVariant = "sky" | "emerald";

// Shared bar fill layer — reused for both the main and overflow bar
function BarFill({
  fromPct,
  toPct,
  isPreview,
  variant = "sky",
}: {
  fromPct: number;
  toPct: number;
  isPreview: boolean;
  variant?: BarVariant;
}) {
  const width = Math.max(0, toPct - fromPct);
  if (width <= 0) return null;

  if (!isPreview) {
    const gradient =
      variant === "emerald"
        ? "from-emerald-800 via-emerald-500 to-emerald-300"
        : "from-sky-800 via-sky-500 to-sky-300";

    return (
      <div
        className="absolute inset-y-0 left-0 rounded-[4px] overflow-hidden transition-[width] duration-1000 ease-out"
        style={{ width: `${toPct}%` }}
      >
        <div className={`absolute inset-0 bg-gradient-to-r ${gradient}`} />
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 7px)" }}
        />
        <div
          className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          style={{ animation: "funding-scan 2.8s linear infinite" }}
        />
        <div className="absolute inset-x-0 top-0 h-[35%] bg-gradient-to-b from-white/20 to-transparent rounded-t-[4px]" />
        <div className="absolute inset-x-0 bottom-0 h-[25%] bg-gradient-to-t from-black/30 to-transparent" />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-y-0 overflow-hidden transition-[width,left] duration-300 ease-out"
      style={{
        left: `${fromPct}%`,
        width: `${width}%`,
        animation: "preview-shimmer 2s ease-in-out infinite",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/40 to-amber-300/60" />
      <div
        className="absolute inset-0 opacity-30"
        style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 7px)" }}
      />
      <div className="absolute inset-x-0 top-0 h-[35%] bg-gradient-to-b from-white/15 to-transparent" />
      {/* Dashed right edge */}
      <div className="absolute right-0 inset-y-0 w-[2px] flex flex-col">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={`flex-1 ${i % 2 === 0 ? "bg-amber-200/80" : "bg-transparent"}`} />
        ))}
      </div>
    </div>
  );
}

function BarTrack({
  height = "h-7",
  realFillPct,
  previewFromPct,
  previewToPct,
  showTip,
  variant = "sky",
}: {
  height?: string;
  realFillPct: number;
  previewFromPct: number;
  previewToPct: number;
  showTip: boolean;
  variant?: BarVariant;
}) {
  const glowAnim = variant === "emerald" ? "funding-outer-glow-emerald" : "funding-outer-glow";
  const tipColor = variant === "emerald" ? "bg-emerald-100/80" : "bg-white/80";

  return (
    <div
      className={`relative ${height} w-full rounded-[4px] overflow-hidden`}
      style={{ animation: `${glowAnim} 3s ease-in-out infinite` }}
    >
      <div className="absolute inset-0 bg-slate-950 rounded-[4px]" />

      <BarFill fromPct={0} toPct={realFillPct} isPreview={false} variant={variant} />

      {showTip && realFillPct > 0 && previewFromPct === 0 && (
        <div
          className={`absolute inset-y-0 w-[3px] ${tipColor} rounded-r-[4px]`}
          style={{ left: `calc(${realFillPct}% - 3px)`, animation: "funding-tip-pulse 1.6s ease-in-out infinite" }}
        />
      )}

      <BarFill fromPct={previewFromPct} toPct={previewToPct} isPreview />

      {[25, 50, 75].map((p) => (
        <div
          key={p}
          className="absolute inset-y-0 w-px z-10 pointer-events-none"
          style={{
            left: `${p}%`,
            background: "linear-gradient(to bottom, rgba(148,163,184,0.05), rgba(148,163,184,0.25) 40%, rgba(148,163,184,0.25) 60%, rgba(148,163,184,0.05))",
          }}
        />
      ))}

      <div className="absolute inset-0 rounded-[4px] border border-slate-600/40 pointer-events-none" />
    </div>
  );
}

export function FundingBar({ coveredMinor, targetMinor, previewMinor = 0 }: Props) {
  if (targetMinor <= 0) return null;

  const barsCleared = Math.floor(coveredMinor / targetMinor);
  const overflow = coveredMinor % targetMinor;
  const fillPct = Math.round((overflow / targetMinor) * 100);
  const celebrated = barsCleared >= 1;

  const [displayPct, setDisplayPct] = useState(0);
  useEffect(() => {
    if (fillPct === 0) return;
    const duration = 700;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPct(Math.round(eased * fillPct));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coveredEur = (overflow / 100).toFixed(0);
  const targetEur = (targetMinor / 100).toFixed(0);

  const visibleHistory = Math.min(barsCleared, MAX_HISTORY_BARS);
  const hiddenHistory = barsCleared - visibleHistory;

  // Preview calculations
  const totalWithPreview = overflow + previewMinor;
  const previewWouldFill = previewMinor > 0 && totalWithPreview >= targetMinor;
  const overflowIntoNextMinor = Math.max(0, totalWithPreview - targetMinor);
  const nextBarFillPct = Math.min(Math.round((overflowIntoNextMinor / targetMinor) * 100), 100);
  const nextBarAlsoFills = overflowIntoNextMinor >= targetMinor;

  // Main bar preview segment
  const mainPreviewToPct = previewMinor > 0
    ? previewWouldFill ? 100 : Math.round((totalWithPreview / targetMinor) * 100)
    : fillPct;
  const mainPreviewFromPct = previewMinor > 0 ? fillPct : 0;
  const hasMainPreview = previewMinor > 0 && mainPreviewToPct > fillPct;

  // +% readout in the header
  const previewAddedPct = hasMainPreview ? mainPreviewToPct - fillPct : 0;

  // Next milestone footer
  const nextMilestone = !celebrated ? (MILESTONES.find(m => fillPct < m) ?? null) : null;
  const eurToNextMilestone = nextMilestone !== null
    ? Math.ceil(((nextMilestone / 100) * targetMinor - overflow) / 100)
    : null;

  const footerText = (() => {
    if (celebrated) {
      return "Costs fully covered this month — thank you!";
    }
    if (eurToNextMilestone !== null && nextMilestone !== null) {
      return nextMilestone === 100
        ? `€${eurToNextMilestone} to fully cover this month's costs`
        : `€${eurToNextMilestone} to reach the ${nextMilestone}% milestone`;
    }
    return `€${((targetMinor - overflow) / 100).toFixed(0)} to go`;
  })();

  const cardBorder = celebrated ? "border-emerald-500/25" : "border-slate-800/60";

  return (
    <>
      <style>{`
        @keyframes funding-scan {
          0%   { transform: translateX(-100%) skewX(-20deg); }
          100% { transform: translateX(1200%) skewX(-20deg); }
        }
        @keyframes funding-tip-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px 3px rgba(186,230,253,0.9), 0 0 20px 6px rgba(56,189,248,0.5); }
          50%       { opacity: 0.55; box-shadow: 0 0 4px 1px rgba(186,230,253,0.5), 0 0 10px 2px rgba(56,189,248,0.2); }
        }
        @keyframes funding-outer-glow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(56,189,248,0.15), inset 0 2px 6px rgba(0,0,0,0.7); }
          50%       { box-shadow: 0 0 0 1px rgba(56,189,248,0.35), inset 0 2px 6px rgba(0,0,0,0.7); }
        }
        @keyframes funding-outer-glow-emerald {
          0%, 100% { box-shadow: 0 0 0 1px rgba(52,211,153,0.2), inset 0 2px 6px rgba(0,0,0,0.7); }
          50%       { box-shadow: 0 0 0 1px rgba(52,211,153,0.5), 0 0 14px rgba(52,211,153,0.12), inset 0 2px 6px rgba(0,0,0,0.7); }
        }
        @keyframes preview-shimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 0.75; }
          100% { opacity: 0.4; }
        }
        @keyframes celebrate-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.7; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 mb-10">
        <div className={`rounded-2xl border ${cardBorder} bg-slate-900/40 px-6 py-5 transition-colors duration-700`}>

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">
                  Monthly Costs
                </p>
              </div>

              {/* Cleared history — stacked thin completed bars */}
              {barsCleared > 0 && (
                <div className="flex flex-col gap-1 pt-1">
                  {Array.from({ length: visibleHistory }).map((_, i) => (
                    <div key={i} className="relative h-2 w-full rounded-sm overflow-hidden opacity-50">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-400" />
                      <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/20 to-transparent" />
                      <div className="absolute inset-0 border border-emerald-400/20 rounded-sm" />
                    </div>
                  ))}
                  {hiddenHistory > 0 && (
                    <span className="text-[10px] text-emerald-500/60 font-semibold">+{hiddenHistory} more</span>
                  )}
                </div>
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="flex items-baseline justify-end gap-1.5">
                <p className={`text-3xl font-extrabold tabular-nums leading-none ${celebrated ? "text-emerald-300" : "text-white"}`}>
                  {displayPct}%
                </p>
                {previewAddedPct > 0 && (
                  <p className="text-lg font-bold tabular-nums leading-none text-amber-300/90">
                    +{previewAddedPct}%
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-500 tabular-nums mt-1">
                €{coveredEur} / €{targetEur}
              </p>
            </div>
          </div>

          {/* Milestone labels */}
          <div className="relative h-3.5 mb-0.5">
            {MILESTONES.map((p) => {
              const reached = fillPct >= p;
              const color = reached
                ? celebrated ? "text-emerald-400" : "text-sky-400"
                : "text-slate-700";
              return (
                <div
                  key={p}
                  className="absolute flex flex-col items-center"
                  style={{ left: p === 100 ? "calc(100% - 1px)" : `${p}%`, transform: "translateX(-50%)" }}
                >
                  <span className={`text-[9px] font-bold tabular-nums leading-none ${color}`}>
                    {p}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Main bar */}
          <BarTrack
            realFillPct={fillPct}
            previewFromPct={hasMainPreview ? mainPreviewFromPct : 0}
            previewToPct={hasMainPreview ? mainPreviewToPct : 0}
            showTip={!hasMainPreview}
            variant={celebrated ? "emerald" : "sky"}
          />

          {/* Celebration banner */}
          {celebrated && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300 font-semibold">
                {barsCleared === 1 ? "Goal reached this month!" : `Goal cleared ${barsCleared}× — you're incredible!`}
              </p>
            </div>
          )}

          {/* Overflow bar (preview spills into next period) */}
          {nextBarFillPct > 0 && (
            <>
              <div className="flex items-center gap-2 my-2 pl-1">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-px h-1.5 bg-amber-400/40" />
                  <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-amber-400/60" />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-amber-400/60 font-semibold">
                  next bar{nextBarAlsoFills ? " — and beyond" : ""}
                </p>
              </div>
              <BarTrack
                height="h-5"
                realFillPct={0}
                previewFromPct={0}
                previewToPct={nextBarFillPct}
                showTip={false}
              />
            </>
          )}

          {/* Footer */}
          <div className="mt-2.5 flex items-center justify-between gap-4">
            <p className={`text-xs ${celebrated ? "text-emerald-500" : "text-slate-500"}`}>
              {footerText}
            </p>
            {previewMinor > 0 && (
              <p className="text-xs text-amber-400/80 font-medium shrink-0">
                {nextBarFillPct > 0
                  ? nextBarAlsoFills
                    ? "covers this and more!"
                    : `fills this + ${nextBarFillPct}% of next`
                  : previewWouldFill
                    ? "completes this bar!"
                    : `+€${(previewMinor / 100).toFixed(0)} toward costs`}
              </p>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
