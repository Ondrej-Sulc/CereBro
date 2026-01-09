"use client"

import * as React from "react"
import { CartesianGrid, Area, AreaChart, XAxis, YAxis, ReferenceLine } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface PrestigePoint {
  sig: number;
  prestige: number;
}

interface PrestigeCurveChartProps {
  data: PrestigePoint[];
  currentSig: number;
  championName: string;
  rarity: number;
  rank: number;
}

const chartConfig = {
  prestige: {
    label: "Prestige",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export function PrestigeCurveChart({ data, currentSig, championName, rarity, rank }: PrestigeCurveChartProps) {
  
  // Find min/max for domain
  const minPrestige = Math.min(...data.map(d => d.prestige));
  const maxPrestige = Math.max(...data.map(d => d.prestige));
  const padding = (maxPrestige - minPrestige) * 0.1;

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              left: 0,
              right: 12,
              top: 12,
              bottom: 12,
            }}
          >
            <defs>
              <linearGradient id="fillPrestige" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-prestige)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-prestige)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
            <XAxis
              dataKey="sig"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            
            <YAxis
              orientation="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={5}
              domain={[minPrestige - padding, maxPrestige + padding]}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              width={40}
            />
            
            <ChartTooltip
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(value) => `Sig Level ${value}`}
                />
              }
            />

            <Area
              dataKey="prestige"
              type="monotone"
              fill="url(#fillPrestige)"
              stroke="var(--color-prestige)"
              strokeWidth={2}
            />

            <ReferenceLine 
                x={currentSig} 
                stroke="hsl(var(--chart-2))" 
                strokeDasharray="3 3"
                label={{ 
                    position: 'top', 
                    value: 'Current', 
                    fill: 'hsl(var(--chart-2))', 
                    fontSize: 10 
                }} 
            />

          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
