"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Cell, Pie, PieChart, Area, AreaChart, ComposedChart } from "recharts"
import { format, parseISO } from "date-fns"

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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface GrowthData {
  date: string
  newPlayers: number
  totalPlayers: number
  newAlliances: number
  totalAlliances: number
  newBotUsers: number
  totalBotUsers: number
  newRoster: number
  totalRoster: number
  newDonations: number
  totalDonations: number
  [key: string]: string | number
}

interface RosterDistributionItem {
    stars: number
    rank: number
    count: number
    [key: string]: string | number
}

interface PrestigeDistributionItem {
    prestige: number
    count: number
    [key: string]: string | number
}

interface GrowthChartsProps {
  growthData: GrowthData[]
  rosterDistribution: RosterDistributionItem[]
  prestigeDistribution: PrestigeDistributionItem[]
}

const chartConfig: ChartConfig = {
  newPlayers: {
    label: "Daily New",
    color: "hsl(var(--chart-1))",
  },
  totalPlayers: {
    label: "Total Profiles",
    color: "hsl(var(--chart-2))",
  },
  newAlliances: {
    label: "Daily New",
    color: "hsl(var(--chart-3))",
  },
  totalAlliances: {
    label: "Total Alliances",
    color: "hsl(var(--chart-3))",
  },
  newRoster: {
    label: "Daily Additions",
    color: "hsl(var(--chart-4))",
  },
  totalRoster: {
    label: "Total Champions",
    color: "hsl(var(--chart-4))",
  },
  newDonations: {
    label: "Daily Amount",
    color: "hsl(var(--chart-5))",
  },
  totalDonations: {
    label: "Total Revenue",
    color: "hsl(var(--chart-5))",
  },
  stars6: {
    label: "6-Star",
    color: "hsl(var(--chart-2))",
  },
  stars7: {
    label: "7-Star",
    color: "hsl(var(--chart-1))",
  },
  prestigeCount: {
    label: "Players",
    color: "hsl(var(--chart-1))",
  }
}

const PRESTIGE_STEP_OPTIONS = [500, 1000, 2000, 5000] as const
type PrestigeStep = typeof PRESTIGE_STEP_OPTIONS[number]

function rebucketPrestige(data: PrestigeDistributionItem[], step: number): PrestigeDistributionItem[] {
  const buckets = new Map<number, number>()
  for (const item of data) {
    const bucket = Math.floor(item.prestige / step) * step
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + item.count)
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([prestige, count]) => ({ prestige, count }))
}

export function GrowthCharts({ growthData, rosterDistribution, prestigeDistribution }: GrowthChartsProps) {
  const [prestigeStep, setPrestigeStep] = React.useState<PrestigeStep>(1000)

  const bucketedPrestige = rebucketPrestige(prestigeDistribution, prestigeStep)

  // Process roster data for stacked bar chart
  const processedRoster = [1, 2, 3, 4, 5, 6].map(rank => {
      const star6 = rosterDistribution.find(d => d.stars === 6 && d.rank === rank)?.count || 0
      const star7 = rosterDistribution.find(d => d.stars === 7 && d.rank === rank)?.count || 0
      return {
          rank: `Rank ${rank}`,
          stars6: star6,
          stars7: star7
      }
  }).filter(d => d.stars6 > 0 || d.stars7 > 0)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
      {/* Player Growth (Combined) */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Player Growth</CardTitle>
          <CardDescription>Daily new vs. total player profiles</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer config={chartConfig} className="mx-auto aspect-video max-h-[300px] w-full">
            <ComposedChart data={growthData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => format(parseISO(value), "MMM d")}
              />
              <YAxis yAxisId="left" hide />
              <YAxis yAxisId="right" orientation="right" hide />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
              />
              <Bar yAxisId="left" dataKey="newPlayers" fill="var(--color-newPlayers)" radius={4} />
              <Line yAxisId="right" type="monotone" dataKey="totalPlayers" stroke="var(--color-totalPlayers)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Donation Growth */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Supporter Donations</CardTitle>
          <CardDescription>Daily amount and cumulative revenue</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer config={chartConfig} className="mx-auto aspect-video max-h-[300px] w-full">
            <ComposedChart data={growthData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => format(parseISO(value), "MMM d")}
              />
              <YAxis yAxisId="left" hide />
              <YAxis yAxisId="right" orientation="right" hide />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
              />
              <Bar yAxisId="left" dataKey="newDonations" fill="var(--color-newDonations)" radius={4} />
              <Line yAxisId="right" type="monotone" dataKey="totalDonations" stroke="var(--color-totalDonations)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Roster Size Growth (Total) */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Roster Expansion (Total)</CardTitle>
          <CardDescription>Cumulative champions tracked in CereBro</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer config={chartConfig} className="mx-auto aspect-video max-h-[300px] w-full">
            <AreaChart data={growthData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => format(parseISO(value), "MMM d")}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
              />
              <Area
                type="monotone"
                dataKey="totalRoster"
                stroke="var(--color-totalRoster)"
                fill="var(--color-totalRoster)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Roster Distribution (Stars & Rank) */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Roster Distribution (Stars & Rank)</CardTitle>
          <CardDescription>Combined meta-progression for 6* and 7*</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer config={chartConfig} className="mx-auto aspect-video max-h-[300px] w-full">
             <BarChart data={processedRoster}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                    dataKey="rank"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="stars7" stackId="a" fill="var(--color-stars7)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="stars6" stackId="a" fill="var(--color-stars6)" radius={[4, 4, 0, 0]} />
             </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Alliance Total Growth */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Total Alliances</CardTitle>
          <CardDescription>Cumulative alliances over time</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer config={chartConfig} className="mx-auto aspect-video max-h-[300px] w-full">
            <AreaChart data={growthData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => format(parseISO(value), "MMM d")}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
              />
              <Area
                type="monotone"
                dataKey="totalAlliances"
                stroke="var(--color-totalAlliances)"
                fill="var(--color-totalAlliances)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Prestige Distribution Curve */}
      <Card className="flex flex-col md:col-span-2">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <CardTitle>Prestige Distribution Curve</CardTitle>
              <CardDescription>Player population across prestige spectrum</CardDescription>
            </div>
            <Select
              value={String(prestigeStep)}
              onValueChange={(v) => setPrestigeStep(Number(v) as PrestigeStep)}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESTIGE_STEP_OPTIONS.map((step) => (
                  <SelectItem key={step} value={String(step)} className="text-xs">
                    {step.toLocaleString()} step
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer config={chartConfig} className="mx-auto aspect-[4/1] w-full">
             <AreaChart data={bucketedPrestige}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                    dataKey="prestige"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
                />
                <YAxis hide />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent labelFormatter={(v) => v != null ? `Prestige: ${v.toLocaleString()}` : ""} />}
                />
                <Area 
                    type="monotone" 
                    dataKey="count" 
                    name="prestigeCount"
                    stroke="var(--color-stars7)" 
                    fill="var(--color-stars7)" 
                    fillOpacity={0.2} 
                    strokeWidth={2} 
                />
             </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
