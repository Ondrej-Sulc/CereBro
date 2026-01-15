'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    className?: string;
}

const PRESET_COLORS = [
    // Reds
    "#ef4444", "#dc2626", "#991b1b",
    // Oranges
    "#f97316", "#ea580c", "#9a3412",
    // Yellows
    "#eab308", "#ca8a04", "#854d0e",
    // Greens
    "#22c55e", "#16a34a", "#166534",
    // Sky
    "#0ea5e9", "#0284c7", "#075985",
    // Blue
    "#3b82f6", "#2563eb", "#1e40af",
    // Indigo
    "#6366f1", "#4f46e5", "#3730a3",
    // Purple
    "#a855f7", "#9333ea", "#6b21a8",
    // Pink
    "#ec4899", "#db2777", "#9d174d",
    // Slate/Grey
    "#64748b", "#475569", "#1e293b",
];

export function ColorPicker({ color, onChange, className }: ColorPickerProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button 
                    variant="outline" 
                    className={cn("w-full justify-start gap-3 px-3 h-10 border-slate-800 bg-slate-950 hover:bg-slate-900", className)}
                >
                    <div 
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm" 
                        style={{ backgroundColor: color }} 
                    />
                    <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                        {color}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-slate-950 border-slate-800 p-3">
                <div className="space-y-4">
                    <div className="grid grid-cols-6 gap-2">
                        {PRESET_COLORS.map((preset) => (
                            <button
                                key={preset}
                                onClick={() => onChange(preset)}
                                className={cn(
                                    "w-8 h-8 rounded-md border border-white/10 transition-transform hover:scale-110 flex items-center justify-center relative",
                                    color.toLowerCase() === preset.toLowerCase() && "ring-2 ring-sky-500 ring-offset-2 ring-offset-slate-950"
                                )}
                                style={{ backgroundColor: preset }}
                            >
                                {color.toLowerCase() === preset.toLowerCase() && (
                                    <Check className="w-4 h-4 text-white drop-shadow-md" />
                                )}
                            </button>
                        ))}
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Custom Hex</p>
                        <div className="flex gap-2">
                            <div 
                                className="w-10 h-10 rounded-md border border-slate-800 shrink-0" 
                                style={{ backgroundColor: color }} 
                            />
                            <Input 
                                value={color}
                                onChange={(e) => onChange(e.target.value)}
                                className="h-10 bg-slate-900 border-slate-800 font-mono text-xs uppercase"
                                placeholder="#000000"
                            />
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
