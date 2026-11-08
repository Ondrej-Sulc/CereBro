"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ExternalLink, Maximize2, Minimize2, X, ZoomIn } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import styles from "./screenshot-preview.module.css";

type ScreenshotPreviewProps = {
  src: string;
  alt: string;
  title: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
};

export function ScreenshotPreview({
  src, alt, title, width, height, sizes, priority, className, imageClassName,
}: ScreenshotPreviewProps) {
  const [open, setOpen] = useState(false);
  const [actualSize, setActualSize] = useState(false);
  const viewportStyle: CSSProperties & { "--screenshot-ratio": string } = {
    "--screenshot-ratio": `${width} / ${height}`,
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) setActualSize(false);
    }}>
      <DialogTrigger asChild>
        <button type="button" className={`${styles.trigger} ${className ?? ""}`} aria-label={`Enlarge ${title} screenshot`}>
          <Image src={src} alt={alt} width={width} height={height} sizes={sizes} priority={priority} className={`${styles.thumbnail} ${imageClassName ?? ""}`} />
          <span className={styles.affordance}><ZoomIn aria-hidden="true" /><span>Enlarge</span></span>
        </button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="z-[200]" />
        <DialogPrimitive.Content className={`${styles.dialog} ${actualSize ? styles.actualDialog : ""}`}>
          <div className={styles.header}>
            <div>
              <DialogTitle className={styles.title}>{title}</DialogTitle>
              <DialogDescription className={styles.description}>
                {actualSize
                  ? "Scroll or swipe to pan. Fit to screen shows the whole image."
                  : "Choose Actual size to read text, then scroll or swipe to pan."}
              </DialogDescription>
            </div>
            <DialogClose asChild><button type="button" className={styles.close} aria-label="Close screenshot"><X aria-hidden="true" /><span>Close</span></button></DialogClose>
          </div>
          <div className={`${styles.viewport} ${actualSize ? styles.actualSize : ""}`} style={viewportStyle} role="region" aria-label={`${title} screenshot`} tabIndex={0}>
            <Image src={src} alt={alt} width={width} height={height} unoptimized className={styles.fullImage} style={actualSize ? { width, height: "auto" } : undefined} />
          </div>
          <div className={styles.toolbar}>
            <button type="button" className={styles.modeAction} onClick={() => setActualSize((value) => !value)}>
              {actualSize ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
              {actualSize ? "Fit to screen" : "Actual size"}
            </button>
            <a href={src} target="_blank" rel="noopener noreferrer">Open original image <ExternalLink aria-hidden="true" /></a>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
