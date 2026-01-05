"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PrestigeLogData {
  createdAt: Date;
  championPrestige: number;
  summonerPrestige: number;
}

interface PrestigeHistoryChartProps {
  data: PrestigeLogData[];
  className?: string;
}

// Helper to calculate control points for smooth Bezier curves (Catmull-Rom)
function getControlPoints(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  tension = 0.4
) {
  const d1 = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
  const d2 = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  
  const fa = tension * d1 / (d1 + d2);
  const fb = tension * d2 / (d1 + d2);
  
  const p1x = x1 - fa * (x2 - x0);
  const p1y = y1 - fa * (y2 - y0);
  
  const p2x = x1 + fb * (x2 - x0);
  const p2y = y1 + fb * (y2 - y0);
  
  return [p1x, p1y, p2x, p2y];
}

// Generate SVG Path Command
function generateSmoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";

  let d = `M ${points[0].x} ${points[0].y}`;

  // For only 2 points, draw a straight line
  if (points.length === 2) {
    return `${d} L ${points[1].x} ${points[1].y}`;
  }

  // Loop through points to create curves
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2; // Duplicate last point

    const cp1x = p1.x + (p2.x - p0.x) * 0.15; // Simple tension approach
    const cp1y = p1.y + (p2.y - p0.y) * 0.15;
    
    const cp2x = p2.x - (p3.x - p1.x) * 0.15;
    const cp2y = p2.y - (p3.y - p1.y) * 0.15;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

export function PrestigeHistoryChart({ data, className }: PrestigeHistoryChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const processedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    const width = 100;
    const height = 50;
    const paddingX = 2;
    const paddingY = 8;

    if (sorted.length < 2) return null;

    const startTime = sorted[0].createdAt.getTime();
    const endTime = sorted[sorted.length - 1].createdAt.getTime();
    const totalTime = endTime - startTime || 1;

    // Helper to normalize values
    const normalize = (val: number, min: number, max: number) => {
        const range = max - min || 1;
        // Buffer of 10%
        const bufferedMin = min - (range * 0.1);
        const bufferedMax = max + (range * 0.1);
        const bufferedRange = bufferedMax - bufferedMin;
        
        const normalized = (val - bufferedMin) / bufferedRange;
        return height - paddingY - normalized * (height - 2 * paddingY);
    };

    // 1. Champion Prestige Scale
    const champValues = sorted.map(d => d.championPrestige);
    const champMin = Math.min(...champValues);
    const champMax = Math.max(...champValues);

    // 2. Summoner Prestige Scale
    const sumValues = sorted.map(d => d.summonerPrestige);
    const sumMin = Math.min(...sumValues);
    const sumMax = Math.max(...sumValues);

    const points = sorted.map((d) => {
      const timeSinceStart = d.createdAt.getTime() - startTime;
      const x = paddingX + (timeSinceStart / totalTime) * (width - 2 * paddingX);
      
      return {
        x,
        original: d,
        yChamp: normalize(d.championPrestige, champMin, champMax),
        ySum: normalize(d.summonerPrestige, sumMin, sumMax),
      };
    });

    return { points, width, height };
  }, [data]);

  if (!processedData) return null;
  const { points, width, height } = processedData;

  const champPath = generateSmoothPath(points.map(p => ({ x: p.x, y: p.yChamp })));
  const sumPath = generateSmoothPath(points.map(p => ({ x: p.x, y: p.ySum })));

  return (
    <Card className={cn("bg-slate-900/50 border-slate-800 h-full flex flex-col", className)}>
      <CardHeader className="pb-4 border-b border-slate-800/50 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-slate-400">
          Prestige History
        </CardTitle>
        
        {/* Legend */}
        <div className="flex gap-4 text-xs">
             <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-sky-400" />
                <span className="text-slate-300">Summoner</span>
             </div>
             <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
                <span className="text-slate-300">Champion</span>
             </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-end min-h-[200px] pt-6">
        <div className="relative w-full flex-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            {/* Grid Lines */}
            {[0.2, 0.4, 0.6, 0.8].map((offset) => (
                 <line
                 key={offset}
                 x1={0}
                 y1={height * offset}
                 x2={width}
                 y2={height * offset}
                 stroke="currentColor"
                 className="text-slate-800/30"
                 strokeWidth="0.2"
               />
            ))}

            {/* Summoner Line */}
            <motion.path
              d={sumPath}
              fill="none"
              stroke="#38bdf8" // sky-400
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />

            {/* Champion Line */}
            <motion.path
              d={champPath}
              fill="none"
              stroke="#a78bfa" // violet-400
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
            />

            {/* Interactive Points */}
            <TooltipProvider>
              {points.map((point, i) => (
                <Tooltip key={i} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <g 
                       className="cursor-pointer group"
                       onMouseEnter={() => setHoveredIndex(i)}
                       onMouseLeave={() => setHoveredIndex(null)}
                    >
                        {/* Invisible Hit Area */}
                        <rect 
                            x={point.x - 2} 
                            y={0} 
                            width={4} 
                            height={height} 
                            fill="transparent" 
                        />
                        
                        {/* Vertical Indicator Line (visible on hover) */}
                        <motion.line
                            x1={point.x} y1={5}
                            x2={point.x} y2={height - 5}
                            stroke="white"
                            strokeWidth="0.5"
                            strokeDasharray="2 2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: hoveredIndex === i ? 0.5 : 0 }}
                        />

                        {/* Summoner Point */}
                        <motion.circle
                            cx={point.x} cy={point.ySum}
                            r={1.5}
                            className="fill-slate-950 stroke-sky-400 stroke-[1.5px]"
                            animate={{ 
                                r: hoveredIndex === i ? 3 : 1.5,
                                opacity: hoveredIndex === i || hoveredIndex === null ? 1 : 0.3
                            }}
                        />

                        {/* Champion Point */}
                        <motion.circle
                            cx={point.x} cy={point.yChamp}
                            r={1.5}
                            className="fill-slate-950 stroke-violet-400 stroke-[1.5px]"
                            animate={{ 
                                r: hoveredIndex === i ? 3 : 1.5,
                                opacity: hoveredIndex === i || hoveredIndex === null ? 1 : 0.3
                            }}
                        />
                    </g>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-slate-950/95 backdrop-blur border-slate-800 p-3 shadow-2xl"
                  >
                    <div className="space-y-2">
                        <div className="text-xs text-slate-400 border-b border-slate-800 pb-1 mb-1">
                            {format(point.original.createdAt, "MMM d, yyyy")}
                        </div>
                        <div className="flex items-center justify-between gap-4 text-xs">
                            <span className="text-sky-400">Summoner</span>
                            <span className="font-bold font-mono">{point.original.summonerPrestige.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-xs">
                            <span className="text-violet-400">Champion</span>
                            <span className="font-bold font-mono">{point.original.championPrestige.toLocaleString()}</span>
                        </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </svg>
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold text-slate-600 mt-4 border-t border-slate-800 pt-2">
            <span>{data.length > 0 && format(data[0].createdAt, "MMM d")}</span>
            <span>{data.length > 0 && format(data[data.length - 1].createdAt, "MMM d")}</span>
        </div>
      </CardContent>
    </Card>
  );
}