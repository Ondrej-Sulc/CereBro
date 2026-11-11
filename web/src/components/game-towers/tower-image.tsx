"use client";
import { useState } from "react";

/** Native art keeps its space even when the image fails to load. */
export function TowerImage({ src, alt = "", className, eager = false }: { src: string | null | undefined; alt?: string; className?: string; eager?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return src && failedSrc !== src
    // Native snapshots and public portrait URLs are already sized by the adapter.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={alt} className={className} loading={eager ? "eager" : "lazy"} decoding="async" ref={element => { if (element?.complete && element.naturalWidth === 0) setFailedSrc(src); }} onError={() => setFailedSrc(src)} />
    : <span className={className} role={alt ? "img" : undefined} aria-label={alt || undefined} data-image-fallback><svg viewBox="0 0 48 64" aria-hidden="true"><path d="M15 58V24l9-16 9 16v34M10 58h28M15 35h18M15 47h18M24 24v34" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span>;
}
