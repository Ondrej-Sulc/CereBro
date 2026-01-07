"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface InteractiveScreenshotDeckProps {
  images: string[];
  alt: string;
  // Controls the width of the cards. Height will be determined by the image aspect ratio.
  widthClass?: string;
  // Controls how much they overlap (negative margin)
  overlap?: string;
}

export function InteractiveScreenshotDeck({
  images,
  alt,
  widthClass = "w-64",
  overlap = "-space-x-32",
}: InteractiveScreenshotDeckProps) {
  return (
    <div className={cn("flex items-center justify-center py-12 isolate", overlap)}>
      {images.map((src, idx) => (
        <div
          key={idx}
          className={cn(
            "relative flex-shrink-0 transition-all duration-500 ease-out h-auto",
            // Base styles
            "rounded-2xl border border-slate-700/50 bg-slate-900 shadow-2xl",
            // Interaction
            "hover:z-50 hover:scale-110 hover:-translate-y-4 hover:shadow-indigo-500/20 hover:border-slate-500",
            // Subtle rotation for "hand of cards" feel, straightening on hover
            idx % 2 === 0 ? "-rotate-2" : "rotate-2",
            "hover:rotate-0",
            // Width control
            widthClass
          )}
        >
            {/* Background Blur for ambient glow */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl opacity-40 -z-10">
                <img 
                    src={src} 
                    alt="" 
                    className="w-full h-full object-cover blur-2xl scale-150" 
                />
            </div>
            
            {/* Main Image - Natural Aspect Ratio */}
            <div className="relative p-1 w-full">
                <img
                    src={src}
                    alt={`${alt} ${idx + 1}`}
                    className="w-full h-auto rounded-xl drop-shadow-md block"
                />
            </div>
            
            {/* Glossy sheen overlay */}
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />
        </div>
      ))}
    </div>
  );
}