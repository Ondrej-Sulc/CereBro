"use client";

const MAX_VISIBLE_PIPS = 12;

type Props = {
  coveredMinor: number;
  targetMinor: number;
  previewMinor?: number;
};

// Shared bar fill layer — reused for both the main and overflow bar
function BarFill({ fromPct, toPct, isPreview }: { fromPct: number; toPct: number; isPreview: boolean }) {
  const width = Math.max(0, toPct - fromPct);
  if (width <= 0) return null;

  if (!isPreview) {
    return (
      <div
        className="absolute inset-y-0 left-0 rounded-[4px] overflow-hidden transition-[width] duration-1000 ease-out"
        style={{ width: `${toPct}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-sky-800 via-sky-500 to-sky-300" />
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
}: {
  height?: string;
  realFillPct: number;
  previewFromPct: number;
  previewToPct: number;
  showTip: boolean;
}) {
  return (
    <div
      className={`relative ${height} w-full rounded-[4px] overflow-hidden`}
      style={{ animation: "funding-outer-glow 3s ease-in-out infinite" }}
    >
      <div className="absolute inset-0 bg-slate-950 rounded-[4px]" />

      <BarFill fromPct={0} toPct={realFillPct} isPreview={false} />

      {showTip && realFillPct > 0 && previewFromPct === 0 && (
        <div
          className="absolute inset-y-0 w-[3px] bg-white/80 rounded-r-[4px]"
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

  const coveredEur = (overflow / 100).toFixed(0);
  const targetEur = (targetMinor / 100).toFixed(0);

  const visiblePips = Math.min(barsCleared, MAX_VISIBLE_PIPS);
  const hiddenPips = barsCleared - visiblePips;

  // Preview calculations
  const totalWithPreview = overflow + previewMinor;
  const previewWouldFill = previewMinor > 0 && totalWithPreview >= targetMinor;
  const overflowIntoNextMinor = Math.max(0, totalWithPreview - targetMinor);
  const nextBarFillPct = Math.min(Math.round((overflowIntoNextMinor / targetMinor) * 100), 100);
  const nextBarAlsoFills = overflowIntoNextMinor >= targetMinor;

  // Main bar preview segment: if overflow, fill to 100; otherwise partial
  const mainPreviewToPct = previewMinor > 0
    ? previewWouldFill
      ? 100
      : Math.round((totalWithPreview / targetMinor) * 100)
    : fillPct;
  const mainPreviewFromPct = previewMinor > 0 ? fillPct : 0;
  const hasMainPreview = previewMinor > 0 && mainPreviewToPct > fillPct;

  // +% readout in the header
  const previewAddedPct = hasMainPreview ? mainPreviewToPct - fillPct : 0;

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
        @keyframes funding-pip-flicker {
          0%, 90%, 100% { opacity: 1; }
          95%            { opacity: 0.7; }
        }
        @keyframes preview-shimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 0.75; }
          100% { opacity: 0.4; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 mb-10">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-5">

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="space-y-2.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">
                  Monthly Costs
                </p>
                {barsCleared > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-bold tracking-wide">
                    cleared {barsCleared}×
                  </span>
                )}
              </div>

              {barsCleared > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Array.from({ length: visiblePips }).map((_, i) => (
                    <div
                      key={i}
                      style={{ animation: `funding-pip-flicker ${2.5 + i * 0.3}s ease-in-out infinite` }}
                      className="h-4 w-7 rounded-[3px] relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-sky-400 to-sky-600" />
                      <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/25 to-transparent" />
                      <div className="absolute inset-0 rounded-[3px] border border-sky-300/40 shadow-[0_0_6px_rgba(56,189,248,0.7)]" />
                    </div>
                  ))}
                  {hiddenPips > 0 && (
                    <span className="text-xs text-sky-400/70 font-semibold ml-0.5">+{hiddenPips}</span>
                  )}
                </div>
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="flex items-baseline justify-end gap-1.5">
                <p className="text-3xl font-extrabold text-white tabular-nums leading-none">{fillPct}%</p>
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

          {/* Main bar */}
          <BarTrack
            realFillPct={fillPct}
            previewFromPct={hasMainPreview ? mainPreviewFromPct : 0}
            previewToPct={hasMainPreview ? mainPreviewToPct : 0}
            showTip={!hasMainPreview}
          />

          {/* Overflow bar */}
          {nextBarFillPct > 0 && (
            <>
              {/* Connector */}
              <div className="flex items-center gap-2 my-2 pl-1">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-px h-1.5 bg-amber-400/40" />
                  <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-amber-400/60" />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-amber-400/60 font-semibold">
                  next bar{nextBarAlsoFills ? " — and beyond" : ""}
                </p>
              </div>

              {/* The overflow bar itself — slightly shorter to show it's "potential" */}
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
            <p className="text-xs text-slate-500">
              {fillPct < 100
                ? barsCleared === 0
                  ? `€${((targetMinor - overflow) / 100).toFixed(0)} to go until costs are fully covered this month`
                  : `€${((targetMinor - overflow) / 100).toFixed(0)} to go until next`
                : barsCleared === 1
                  ? "Costs fully covered this month — thank you!"
                  : `Costs covered ${barsCleared}× this month — incredible!`}
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
