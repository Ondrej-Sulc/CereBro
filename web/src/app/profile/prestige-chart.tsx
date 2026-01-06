"use client"

import * as React from "react"
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import { format } from "date-fns"

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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface PrestigeLogData {
  createdAt: Date;
  championPrestige: number;
  summonerPrestige: number;
  relicPrestige: number;
}

interface PrestigeHistoryChartProps {
  data: PrestigeLogData[];
  className?: string;
}

const chartConfig = {
  championPrestige: {
    label: "Champion Prestige",
    color: "hsl(var(--chart-1))",
  },
  relicPrestige: {
    label: "Relic Prestige",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

export function PrestigeHistoryChart({ data, className }: PrestigeHistoryChartProps) {
  const formattedData = React.useMemo(() => {
    return data.map((item) => ({
      ...item,
      date: format(item.createdAt, "MMM d"),
      fullDate: format(item.createdAt, "MMM d, yyyy"),
    }))
  }, [data])

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>Prestige History</CardTitle>
          <CardDescription>
            Historical progression of champion and relic prestige
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <ComposedChart
            accessibilityLayer
            data={formattedData}
            margin={{
              left: 12,
              right: 12,
              top: 12,
              bottom: 12,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              minTickGap={32}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            
            {/* Left Axis: Champion */}
            <YAxis
              yAxisId="left"
              orientation="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={5}
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: "hsl(var(--chart-1))" }}
              width={55}
            />

            {/* Right Axis: Relic */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={5}
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: "hsl(var(--chart-3))" }}
              width={45}
            />
            
            <ChartTooltip
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={
                <ChartTooltipContent
                  labelKey="fullDate"
                  indicator="dot"
                />
              }
            />

            <ChartLegend 
              verticalAlign="top" 
              align="center" 
              content={<ChartLegendContent className="-mt-4 mb-4 justify-center gap-6" />} 
            />

            {/* Champion Line (Left) */}
            <Line
              yAxisId="left"
              dataKey="championPrestige"
              type="monotone"
              stroke="var(--color-championPrestige)"
              strokeWidth={2}
              dot={{
                r: 2,
                fill: "var(--color-championPrestige)",
                strokeWidth: 0,
              }}
              activeDot={{
                r: 4,
                strokeWidth: 0,
              }}
              animationDuration={1500}
            />

            {/* Relic Line (Right) */}
            <Line
              yAxisId="right"
              dataKey="relicPrestige"
              type="monotone"
              stroke="var(--color-relicPrestige)"
              strokeWidth={2}
              dot={{
                r: 2,
                fill: "var(--color-relicPrestige)",
                strokeWidth: 0,
              }}
              activeDot={{
                r: 4,
                strokeWidth: 0,
              }}
              animationDuration={1500}
            />

          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}