const MAX_VISIBLE_PIPS = 12;

type Props = {
  coveredMinor: number;
  targetMinor: number;
};

export function FundingBar({ coveredMinor, targetMinor }: Props) {
  if (targetMinor <= 0) return null;

  const barsCleared = Math.floor(coveredMinor / targetMinor);
  const overflow = coveredMinor % targetMinor;
  const fillPct = Math.round((overflow / targetMinor) * 100);

  const coveredEur = (overflow / 100).toFixed(0);
  const targetEur = (targetMinor / 100).toFixed(0);

  const visiblePips = Math.min(barsCleared, MAX_VISIBLE_PIPS);
  const hiddenPips = barsCleared - visiblePips;

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

              {/* Pip indicators */}
              {barsCleared > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Array.from({ length: visiblePips }).map((_, i) => (
                    <div
                      key={i}
                      style={{ animation: `funding-pip-flicker ${2.5 + i * 0.3}s ease-in-out infinite` }}
                      className="h-4 w-7 rounded-[3px] relative overflow-hidden"
                    >
                      {/* Pip body */}
                      <div className="absolute inset-0 bg-gradient-to-b from-sky-400 to-sky-600" />
                      {/* Pip top sheen */}
                      <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/25 to-transparent" />
                      {/* Pip border */}
                      <div className="absolute inset-0 rounded-[3px] border border-sky-300/40 shadow-[0_0_6px_rgba(56,189,248,0.7)]" />
                    </div>
                  ))}
                  {hiddenPips > 0 && (
                    <span className="text-xs text-sky-400/70 font-semibold ml-0.5">
                      +{hiddenPips}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Percentage readout */}
            <div className="text-right shrink-0">
              <p className="text-3xl font-extrabold text-white tabular-nums leading-none">{fillPct}%</p>
              <p className="text-xs text-slate-500 tabular-nums mt-1">
                €{coveredEur} / €{targetEur}
              </p>
            </div>
          </div>

          {/* ── The bar ── */}
          <div
            className="relative h-7 w-full rounded-[4px] overflow-hidden"
            style={{ animation: "funding-outer-glow 3s ease-in-out infinite" }}
          >
            {/* Track */}
            <div className="absolute inset-0 bg-slate-950 rounded-[4px]" />

            {/* Fill */}
            {fillPct > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-[4px] overflow-hidden transition-[width] duration-1000 ease-out"
                style={{ width: `${fillPct}%` }}
              >
                {/* Base gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-sky-800 via-sky-500 to-sky-300" />

                {/* Diagonal stripe texture */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 7px)",
                  }}
                />

                {/* Moving scan light */}
                <div
                  className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  style={{ animation: "funding-scan 2.8s linear infinite" }}
                />

                {/* Top sheen */}
                <div className="absolute inset-x-0 top-0 h-[35%] bg-gradient-to-b from-white/20 to-transparent rounded-t-[4px]" />

                {/* Bottom shadow */}
                <div className="absolute inset-x-0 bottom-0 h-[25%] bg-gradient-to-t from-black/30 to-transparent" />

                {/* Bright leading-edge tip */}
                <div
                  className="absolute right-0 inset-y-0 w-[3px] bg-white/80 rounded-r-[4px]"
                  style={{ animation: "funding-tip-pulse 1.6s ease-in-out infinite" }}
                />
              </div>
            )}

            {/* Segment notches at 25 / 50 / 75% */}
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

            {/* Outer border overlay (gives a crisp inset frame feel) */}
            <div className="absolute inset-0 rounded-[4px] border border-slate-600/40 pointer-events-none" />
          </div>
          {/* ── End bar ── */}

          <p className="mt-2.5 text-xs text-slate-500">
            {fillPct < 100
              ? barsCleared === 0
                ? `€${((targetMinor - overflow) / 100).toFixed(0)} to go until costs are fully covered this month`
                : `€${((targetMinor - overflow) / 100).toFixed(0)} to go until next`
              : barsCleared === 1
                ? "Costs fully covered this month — thank you!"
                : `Costs covered ${barsCleared}× this month — incredible!`}
          </p>

        </div>
      </div>
    </>
  );
}
