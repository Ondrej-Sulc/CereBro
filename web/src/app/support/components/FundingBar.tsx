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

type BarVariant = "sky" | "emerald" | "violet" | "amber" | "rose";

const BAR_VARIANTS: BarVariant[] = ["sky", "emerald", "violet", "amber", "rose"];

function getBarVariant(index: number): BarVariant {
  return BAR_VARIANTS[((index % BAR_VARIANTS.length) + BAR_VARIANTS.length) % BAR_VARIANTS.length];
}

const VARIANT_CONFIG: Record<BarVariant, {
  gradient: string;
  glowAnim: string;
  tipAnim: string;
  tipBg: string;
  labelColor: string;
  textColor: string;
  cardBorder: string;
  bannerBg: string;
  bannerBorder: string;
  bannerTextColor: string;
  footerTextColor: string;
  historyGradient: string;
  historyBorderColor: string;
  hiddenTextColor: string;
}> = {
  sky: {
    gradient: "from-sky-800 via-sky-500 to-sky-300",
    glowAnim: "funding-outer-glow-sky",
    tipAnim: "funding-tip-pulse-sky",
    tipBg: "bg-white/80",
    labelColor: "text-sky-400",
    textColor: "text-sky-300",
    cardBorder: "border-sky-500/25",
    bannerBg: "bg-sky-500/8",
    bannerBorder: "border-sky-500/20",
    bannerTextColor: "text-sky-300",
    footerTextColor: "text-sky-500",
    historyGradient: "from-sky-700 via-sky-500 to-sky-400",
    historyBorderColor: "border-sky-400/20",
    hiddenTextColor: "text-sky-500/60",
  },
  emerald: {
    gradient: "from-emerald-800 via-emerald-500 to-emerald-300",
    glowAnim: "funding-outer-glow-emerald",
    tipAnim: "funding-tip-pulse-emerald",
    tipBg: "bg-emerald-100/80",
    labelColor: "text-emerald-400",
    textColor: "text-emerald-300",
    cardBorder: "border-emerald-500/25",
    bannerBg: "bg-emerald-500/8",
    bannerBorder: "border-emerald-500/20",
    bannerTextColor: "text-emerald-300",
    footerTextColor: "text-emerald-500",
    historyGradient: "from-emerald-700 via-emerald-500 to-emerald-400",
    historyBorderColor: "border-emerald-400/20",
    hiddenTextColor: "text-emerald-500/60",
  },
  violet: {
    gradient: "from-violet-800 via-violet-500 to-violet-300",
    glowAnim: "funding-outer-glow-violet",
    tipAnim: "funding-tip-pulse-violet",
    tipBg: "bg-violet-100/80",
    labelColor: "text-violet-400",
    textColor: "text-violet-300",
    cardBorder: "border-violet-500/25",
    bannerBg: "bg-violet-500/8",
    bannerBorder: "border-violet-500/20",
    bannerTextColor: "text-violet-300",
    footerTextColor: "text-violet-500",
    historyGradient: "from-violet-700 via-violet-500 to-violet-400",
    historyBorderColor: "border-violet-400/20",
    hiddenTextColor: "text-violet-500/60",
  },
  amber: {
    gradient: "from-amber-800 via-amber-500 to-amber-300",
    glowAnim: "funding-outer-glow-amber",
    tipAnim: "funding-tip-pulse-amber",
    tipBg: "bg-amber-100/80",
    labelColor: "text-amber-400",
    textColor: "text-amber-300",
    cardBorder: "border-amber-500/25",
    bannerBg: "bg-amber-500/8",
    bannerBorder: "border-amber-500/20",
    bannerTextColor: "text-amber-300",
    footerTextColor: "text-amber-500",
    historyGradient: "from-amber-700 via-amber-500 to-amber-400",
    historyBorderColor: "border-amber-400/20",
    hiddenTextColor: "text-amber-500/60",
  },
  rose: {
    gradient: "from-rose-800 via-rose-500 to-rose-300",
    glowAnim: "funding-outer-glow-rose",
    tipAnim: "funding-tip-pulse-rose",
    tipBg: "bg-rose-100/80",
    labelColor: "text-rose-400",
    textColor: "text-rose-300",
    cardBorder: "border-rose-500/25",
    bannerBg: "bg-rose-500/8",
    bannerBorder: "border-rose-500/20",
    bannerTextColor: "text-rose-300",
    footerTextColor: "text-rose-500",
    historyGradient: "from-rose-700 via-rose-500 to-rose-400",
    historyBorderColor: "border-rose-400/20",
    hiddenTextColor: "text-rose-500/60",
  },
};

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
  if (!isPreview && width <= 0) return null;

  if (!isPreview) {
    const { gradient } = VARIANT_CONFIG[variant];
    return (
      <div
        className="absolute inset-y-0 left-0 rounded-[4px] overflow-hidden"
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
  bgVariant,
  isComplete = false,
}: {
  height?: string;
  realFillPct: number;
  previewFromPct: number;
  previewToPct: number;
  showTip: boolean;
  variant?: BarVariant;
  bgVariant?: BarVariant;
  isComplete?: boolean;
}) {
  const cfg = VARIANT_CONFIG[variant];

  return (
    <div
      className={`relative ${height} w-full rounded-[4px] overflow-hidden`}
      style={{ animation: `${cfg.glowAnim} 3s ease-in-out infinite` }}
    >
      <div className="absolute inset-0 bg-slate-950 rounded-[4px]" />

      {bgVariant && (
        <div className="absolute inset-y-0 left-0 right-0 rounded-[4px] overflow-hidden opacity-35">
          <div className={`absolute inset-0 bg-gradient-to-r ${VARIANT_CONFIG[bgVariant].gradient}`} />
          <div
            className="absolute inset-0 opacity-20"
            style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 7px)" }}
          />
          <div className="absolute inset-x-0 top-0 h-[35%] bg-gradient-to-b from-white/20 to-transparent rounded-t-[4px]" />
          <div className="absolute inset-x-0 bottom-0 h-[25%] bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      )}

      <BarFill fromPct={0} toPct={realFillPct} isPreview={false} variant={variant} />

      {showTip && realFillPct > 0 && previewFromPct === 0 && (
        <div
          className={`absolute inset-y-0 w-[3px] ${cfg.tipBg} rounded-r-[4px]`}
          style={{ left: `calc(${realFillPct}% - 3px)`, animation: `${cfg.tipAnim} 1.6s ease-in-out infinite` }}
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

      {isComplete && (
        <div
          className="absolute inset-0 rounded-[4px] pointer-events-none z-20"
          style={{ animation: "bar-complete-flash 0.18s ease-out forwards" }}
        />
      )}
    </div>
  );
}

export function FundingBar({ coveredMinor, targetMinor, previewMinor = 0 }: Props) {
  const [animBar, setAnimBar] = useState(0);
  const [displayPct, setDisplayPct] = useState(0);
  const [shownHistory, setShownHistory] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  const safeTargetMinor = Math.max(targetMinor, 1);
  const barsCleared = targetMinor > 0 ? Math.floor(coveredMinor / safeTargetMinor) : 0;
  const overflow = targetMinor > 0 ? coveredMinor % safeTargetMinor : 0;
  const fillPct = targetMinor > 0 ? Math.round((overflow / safeTargetMinor) * 100) : 0;
  const celebrated = barsCleared >= 1;

  const BAR_FILL_MS = 600;
  const FLASH_MS = 180;

  // Sequential bar-by-bar fill animation
  useEffect(() => {
    const targetPct = animBar < barsCleared ? 100 : fillPct;
    if (targetPct === 0) return;

    const duration = animBar < barsCleared ? BAR_FILL_MS : 1000;
    const start = performance.now();
    let rafId: number;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPct(Math.round(eased * targetPct));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else if (animBar < barsCleared) {
        setJustCompleted(true);
        setTimeout(() => {
          setJustCompleted(false);
          setShownHistory((h) => h + 1);
          setDisplayPct(0);
          setAnimBar((a) => a + 1);
        }, FLASH_MS);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animBar]);

  // Preview appears only after all bar animations complete
  useEffect(() => {
    const totalDuration = barsCleared * (BAR_FILL_MS + FLASH_MS) + 1150;
    const t = setTimeout(() => setPreviewReady(true), totalDuration);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (targetMinor <= 0) return null;

  // When the bar is exactly full (no overflow), animBar has advanced to barsCleared
  // but displayPct reset to 0. Render as if we're still on bar (animBar-1) at 100%.
  const isExactFull = celebrated && fillPct === 0 && animBar === barsCleared;
  const renderAnimBar = isExactFull ? animBar - 1 : animBar;
  const renderDisplayPct = isExactFull ? 100 : displayPct;

  const currentVariant = getBarVariant(renderAnimBar);
  const cfg = VARIANT_CONFIG[currentVariant];

  const targetEur = (targetMinor / 100).toFixed(0);

  const visibleHistory = Math.min(shownHistory, MAX_HISTORY_BARS);
  const hiddenHistory = shownHistory - visibleHistory;

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

  const previewAddedPct = hasMainPreview ? mainPreviewToPct - fillPct : 0;

  // Next milestone footer
  const nextMilestone = !celebrated ? (MILESTONES.find(m => fillPct < m) ?? null) : null;
  const eurToNextMilestone = nextMilestone !== null
    ? Math.ceil(((nextMilestone / 100) * targetMinor - overflow) / 100)
    : null;

  const footerText = (() => {
    if (celebrated) return "Costs fully covered this month — thank you!";
    if (eurToNextMilestone !== null && nextMilestone !== null) {
      return nextMilestone === 100
        ? `€${eurToNextMilestone} to fully cover this month's costs`
        : `€${eurToNextMilestone} to reach the ${nextMilestone}% milestone`;
    }
    return `€${((targetMinor - overflow) / 100).toFixed(0)} to go`;
  })();

  const cardBorder = celebrated ? cfg.cardBorder : "border-slate-800/60";

  return (
    <>
      <style>{`
        @keyframes funding-scan {
          0%   { transform: translateX(-100%) skewX(-20deg); }
          100% { transform: translateX(1200%) skewX(-20deg); }
        }
        @keyframes funding-tip-pulse-sky {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px 3px rgba(186,230,253,0.9), 0 0 20px 6px rgba(56,189,248,0.5); }
          50%       { opacity: 0.55; box-shadow: 0 0 4px 1px rgba(186,230,253,0.5), 0 0 10px 2px rgba(56,189,248,0.2); }
        }
        @keyframes funding-tip-pulse-emerald {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px 3px rgba(167,243,208,0.9), 0 0 20px 6px rgba(52,211,153,0.5); }
          50%       { opacity: 0.55; box-shadow: 0 0 4px 1px rgba(167,243,208,0.5), 0 0 10px 2px rgba(52,211,153,0.2); }
        }
        @keyframes funding-tip-pulse-violet {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px 3px rgba(221,214,254,0.9), 0 0 20px 6px rgba(139,92,246,0.5); }
          50%       { opacity: 0.55; box-shadow: 0 0 4px 1px rgba(221,214,254,0.5), 0 0 10px 2px rgba(139,92,246,0.2); }
        }
        @keyframes funding-tip-pulse-amber {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px 3px rgba(253,230,138,0.9), 0 0 20px 6px rgba(245,158,11,0.5); }
          50%       { opacity: 0.55; box-shadow: 0 0 4px 1px rgba(253,230,138,0.5), 0 0 10px 2px rgba(245,158,11,0.2); }
        }
        @keyframes funding-tip-pulse-rose {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px 3px rgba(254,205,211,0.9), 0 0 20px 6px rgba(244,63,94,0.5); }
          50%       { opacity: 0.55; box-shadow: 0 0 4px 1px rgba(254,205,211,0.5), 0 0 10px 2px rgba(244,63,94,0.2); }
        }
        @keyframes funding-outer-glow-sky {
          0%, 100% { box-shadow: 0 0 0 1px rgba(56,189,248,0.15), inset 0 2px 6px rgba(0,0,0,0.7); }
          50%       { box-shadow: 0 0 0 1px rgba(56,189,248,0.35), inset 0 2px 6px rgba(0,0,0,0.7); }
        }
        @keyframes funding-outer-glow-emerald {
          0%, 100% { box-shadow: 0 0 0 1px rgba(52,211,153,0.2), inset 0 2px 6px rgba(0,0,0,0.7); }
          50%       { box-shadow: 0 0 0 1px rgba(52,211,153,0.5), 0 0 14px rgba(52,211,153,0.12), inset 0 2px 6px rgba(0,0,0,0.7); }
        }
        @keyframes funding-outer-glow-violet {
          0%, 100% { box-shadow: 0 0 0 1px rgba(139,92,246,0.2), inset 0 2px 6px rgba(0,0,0,0.7); }
          50%       { box-shadow: 0 0 0 1px rgba(139,92,246,0.5), 0 0 14px rgba(139,92,246,0.12), inset 0 2px 6px rgba(0,0,0,0.7); }
        }
        @keyframes funding-outer-glow-amber {
          0%, 100% { box-shadow: 0 0 0 1px rgba(245,158,11,0.2), inset 0 2px 6px rgba(0,0,0,0.7); }
          50%       { box-shadow: 0 0 0 1px rgba(245,158,11,0.5), 0 0 14px rgba(245,158,11,0.12), inset 0 2px 6px rgba(0,0,0,0.7); }
        }
        @keyframes funding-outer-glow-rose {
          0%, 100% { box-shadow: 0 0 0 1px rgba(244,63,94,0.2), inset 0 2px 6px rgba(0,0,0,0.7); }
          50%       { box-shadow: 0 0 0 1px rgba(244,63,94,0.5), 0 0 14px rgba(244,63,94,0.12), inset 0 2px 6px rgba(0,0,0,0.7); }
        }
        @keyframes preview-shimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 0.75; }
          100% { opacity: 0.4; }
        }
        @keyframes bar-complete-flash {
          0%   { background: rgba(255,255,255,0); }
          25%  { background: rgba(255,255,255,0.35); }
          100% { background: rgba(255,255,255,0); }
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

              {/* Cleared history — stacked thin completed bars, each in its own variant color */}
              {barsCleared > 0 && (
                <div className="flex flex-col gap-1 pt-1">
                  {Array.from({ length: visibleHistory }).map((_, i) => {
                    const hcfg = VARIANT_CONFIG[getBarVariant(i)];
                    return (
                      <div key={i} className="relative h-2 w-full rounded-sm overflow-hidden opacity-50">
                        <div className={`absolute inset-0 bg-gradient-to-r ${hcfg.historyGradient}`} />
                        <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/20 to-transparent" />
                        <div className={`absolute inset-0 border ${hcfg.historyBorderColor} rounded-sm`} />
                      </div>
                    );
                  })}
                  {hiddenHistory > 0 && (
                    <span className={`text-[10px] font-semibold ${VARIANT_CONFIG[getBarVariant(visibleHistory)].hiddenTextColor}`}>
                      +{hiddenHistory} more
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="flex items-baseline justify-end gap-1.5">
                <p className={`text-3xl font-extrabold tabular-nums leading-none ${celebrated ? cfg.textColor : "text-white"}`}>
                  {renderAnimBar * 100 + renderDisplayPct}%
                </p>
                {previewReady && previewAddedPct > 0 && (
                  <p className="text-lg font-bold tabular-nums leading-none text-amber-300/90">
                    +{previewAddedPct}%
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-500 tabular-nums mt-1">
                of est. €{targetEur}/mo
              </p>
            </div>
          </div>

          {/* Milestone labels */}
          <div className="relative h-3.5 mb-0.5">
            {MILESTONES.map((p) => {
              const reached = renderDisplayPct >= p;
              const color = reached ? cfg.labelColor : "text-slate-700";
              const label = renderAnimBar >= 1 ? `${renderAnimBar * 100 + p}%` : `${p}%`;
              return (
                <div
                  key={p}
                  className="absolute flex flex-col items-center"
                  style={{ left: p === 100 ? "calc(100% - 1px)" : `${p}%`, transform: "translateX(-50%)" }}
                >
                  <span className={`text-[9px] font-bold tabular-nums leading-none ${color}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Main bar */}
          <BarTrack
            realFillPct={renderDisplayPct}
            previewFromPct={hasMainPreview ? mainPreviewFromPct : 0}
            previewToPct={hasMainPreview ? (previewReady ? mainPreviewToPct : mainPreviewFromPct) : 0}
            showTip={!hasMainPreview || !previewReady}
            variant={currentVariant}
            bgVariant={renderAnimBar > 0 ? getBarVariant(renderAnimBar - 1) : undefined}
            isComplete={justCompleted}
          />

          {/* Celebration banner */}
          {celebrated && (
            <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bannerBg} border ${cfg.bannerBorder}`}>
              <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${cfg.bannerTextColor}`} />
              <p className={`text-xs font-semibold ${cfg.bannerTextColor}`}>
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
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className={`text-xs ${celebrated ? cfg.footerTextColor : "text-slate-500"}`}>
              {footerText}
            </p>
            {previewReady && previewMinor > 0 && (
              <p className="text-xs text-amber-400/80 font-medium">
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
