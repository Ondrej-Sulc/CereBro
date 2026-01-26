"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";

interface InteractiveScreenshotDeckProps {
  images: string[];
  alt: string;
  // Controls the width of the cards. Height will be determined by the image aspect ratio.
  widthClass?: string;
  // Controls how much they overlap (negative margin)
  overlap?: string;
  orientation?: "portrait" | "landscape";
}

const ZoomControls = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm p-1.5 rounded-full z-50 pointer-events-auto">
      <button
        onClick={() => zoomOut()}
        className="p-1.5 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
        title="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      <button
        onClick={() => resetTransform()}
        className="p-1.5 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
        title="Reset Zoom"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      <button
        onClick={() => zoomIn()}
        className="p-1.5 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
        title="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
    </div>
  );
};

export function InteractiveScreenshotDeck({
  images,
  alt,
  widthClass,
  overlap = "-space-x-32",
  orientation = "portrait",
}: InteractiveScreenshotDeckProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  const isLandscape = orientation === "landscape";
  const finalWidth = widthClass || (isLandscape ? "w-full max-w-[500px]" : "w-64");

  const closeLightbox = useCallback(() => setSelectedIndex(null), []);
  
  const showNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev === null ? null : (prev + 1) % images.length));
  }, [images.length]);

  const showPrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev === null ? null : (prev - 1 + images.length) % images.length));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") showNext();
      if (e.key === "ArrowLeft") showPrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, closeLightbox, showNext, showPrev]);

  return (
    <>
      <div className={cn("flex items-center justify-center py-12 isolate", overlap)}>
        {images.map((src, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedIndex(idx)}
            className={cn(
              "relative flex-shrink-0 transition-all duration-500 ease-out h-auto cursor-pointer group",
              // Base styles
              "rounded-2xl border border-slate-700/50 bg-slate-900 shadow-2xl",
              // Interaction
              "hover:z-50 hover:scale-105 hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-slate-500",
              // Subtle rotation for "hand of cards" feel, straightening on hover (only if multiple)
              images.length > 1 ? (idx % 2 === 0 ? "-rotate-2" : "rotate-2") : "",
              "hover:rotate-0",
              // Width control
              finalWidth
            )}
          >
              {/* Background Blur for ambient glow */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl opacity-40 -z-10">
                  <Image 
                      src={src} 
                      alt="" 
                      fill
                      className="object-cover blur-2xl scale-150"
                      quality={10}
                      aria-hidden="true"
                  />
              </div>
              
              {/* Main Image - Natural Aspect Ratio */}
              <div className="relative p-1 w-full">
                  <Image
                      src={src}
                      alt={`${alt} ${idx + 1}`}
                      width={isLandscape ? 1200 : 600}
                      height={isLandscape ? 675 : 1200}
                      className="w-full h-auto rounded-xl drop-shadow-md"
                      sizes="(max-width: 768px) 100vw, 600px"
                      style={{ width: "100%", height: "auto" }}
                  />
                  
                  {/* Hover Overlay Hint */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="bg-black/50 backdrop-blur-sm p-3 rounded-full text-white/90 shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
                      <ZoomIn className="w-6 h-6" />
                    </div>
                  </div>
              </div>
              
              {/* Glossy sheen overlay */}
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
            onClick={closeLightbox}
          >
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 md:top-8 md:right-8 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
              aria-label="Close"
            >
              <X className="w-6 h-6 md:w-8 md:h-8" />
            </button>

            {/* Navigation Buttons */}
            <button
              onClick={showPrev}
              className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50 hidden md:block"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              onClick={showNext}
              className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50 hidden md:block"
              aria-label="Next image"
            >
              <ChevronRight className="w-8 h-8" />
            </button>

            {/* Main Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-6xl max-h-[90vh] flex items-center justify-center pointer-events-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pointer-events-auto relative w-full h-full flex items-center justify-center">
                <TransformWrapper
                  initialScale={1}
                  minScale={0.5}
                  maxScale={4}
                  centerOnInit
                  wheel={{ step: 0.2 }}
                >
                  <React.Fragment>
                    <ZoomControls />
                    <TransformComponent
                      wrapperClass="!w-full !h-full flex items-center justify-center"
                      contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Image
                        src={images[selectedIndex]}
                        alt={`${alt} Full View`}
                        width={1920}
                        height={1080}
                        className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        quality={90}
                        priority
                      />
                    </TransformComponent>
                  </React.Fragment>
                </TransformWrapper>
              </div>
              
               {/* Mobile Navigation Areas (invisible touch targets) */}
               <div className="absolute inset-y-0 left-0 w-12 z-[60] md:hidden pointer-events-auto" onClick={showPrev} />
               <div className="absolute inset-y-0 right-0 w-12 z-[60] md:hidden pointer-events-auto" onClick={showNext} />
            </motion.div>
            
            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
               {selectedIndex + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}