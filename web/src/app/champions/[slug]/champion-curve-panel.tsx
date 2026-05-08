"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { Sparkles } from "lucide-react"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { prepareChampionAbilityCurveView } from "@/lib/champion-ability-text"
import type { ChampionDetailsPayload, ChampionStatRow } from "./champion-details-client"

const CURVE_COLORS = ["#38bdf8", "#fbbf24", "#a78bfa", "#34d399", "#fb7185", "#f97316", "#22c55e", "#e879f9"]

const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export function CurvePanel({
  curves,
  sigLevel,
  stat,
  accent,
}: {
  curves: ChampionDetailsPayload["abilityCurves"]
  sigLevel: number
  stat?: ChampionStatRow
  accent: string
}) {
  const curveView = useMemo(
    () => prepareChampionAbilityCurveView({ curves, stat, sigLevel }),
    [curves, stat, sigLevel]
  )

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: accent }} />
          <h2 className="text-sm font-black uppercase text-white">Signature Curve</h2>
        </div>
      </div>
      {curveView.series.length && curveView.data.length ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
          <AreaChart data={curveView.data} margin={{ left: 0, right: 12, top: 10, bottom: 8 }}>
            <defs>
              {curveView.series.map((series, index) => (
                <linearGradient key={series.id} id={`signatureCurveFill${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CURVE_COLORS[index % CURVE_COLORS.length] ?? accent} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={CURVE_COLORS[index % CURVE_COLORS.length] ?? accent} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.12} />
            <XAxis dataKey="sig" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={46} tick={{ fontSize: 11, fill: "#94a3b8" }} domain={curveView.domain} tickFormatter={(val) => Math.round(val).toLocaleString()} />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" labelFormatter={(_, payload) => {
              const sig = payload?.[0]?.payload?.sig
              return sig === sigLevel ? `Sig ${sig} (Selected)` : `Sig ${sig ?? "?"}`
            }} />} />
            {curveView.series.map((series, index) => (
              <Area
                key={series.id}
                dataKey={series.dataKey}
                name={series.label}
                type="monotone"
                fill={`url(#signatureCurveFill${index})`}
                stroke={CURVE_COLORS[index % CURVE_COLORS.length] ?? accent}
                strokeWidth={2}
              />
            ))}
            <ReferenceLine x={sigLevel} stroke="#f8fafc" strokeDasharray="3 3" />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="rounded-md border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm leading-6 text-slate-400">
          Signature curve records are not imported yet. The chart is ready to render once `ChampionAbilityCurve` has data.
        </div>
      )}
      {curveView.series.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {curveView.series.map((series, index) => (
            <span key={series.id} className="inline-flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CURVE_COLORS[index % CURVE_COLORS.length] ?? accent }} />
              {series.label}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
