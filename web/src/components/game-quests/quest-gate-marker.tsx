"use client";

import { useId, useState, type CSSProperties } from "react";
import { KeyRound, Tags, UserRound, Waypoints } from "lucide-react";
import type { QuestGateView } from "@/lib/game-quests/map-features";
import styles from "./quest-map-features.module.css";

function captionLines(caption: string): string[] {
  const lines: string[] = [];
  for (const word of caption.split(/\s+/)) {
    if (!lines.length || lines.at(-1)!.length + word.length + 1 > 19) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  if (lines.length > 3) return [...lines.slice(0, 2), `${lines.slice(2).join(" ").slice(0, 18)}…`];
  return lines;
}

export function QuestGateMarker({ gate }: { gate: QuestGateView }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [failed, setFailed] = useState<string[]>([]);
  const visual = gate.resolved ? gate.visual : undefined;
  const kind = visual?.kind ?? "unknown";
  const caption = visual?.caption || "Gate";
  const candidates = (visual?.images ?? []).slice(0, 3);
  const images = candidates.some(image => failed.includes(image.src)) ? [] : candidates;
  const showCaption = !images.length && kind !== "rarity";
  const width = questGateMarkerWidth(gate, images.length);
  const half = width / 2, color = visual?.color ?? "#e3bb75";
  const frame = `M${-half + 12}-29H${half - 12}L${half}-17V17L${half - 12}29H${-half + 12}L${-half}17V-17Z`;
  const lines = captionLines(caption);
  const Fallback = kind === "champion" ? UserRound : kind === "resource" ? KeyRound : kind === "switch" ? Waypoints : Tags;
  const imageSize = images.length === 1 ? 44 : images.length === 2 ? 30 : 23;
  return <g data-gate-kind={kind} aria-hidden="true" style={{ "--gate-accent": color } as CSSProperties}>
    <desc>{caption}</desc>
    <defs><clipPath id={`gate-face-${id}`}><path d={frame}/></clipPath></defs>
    <path className={styles.gateFrame} d={frame}/>
    {images.map((image, index) => <image key={image.src} href={image.src} data-gate-image-label={image.label}
      x={(index - (images.length - 1) / 2) * (imageSize + 7) - imageSize / 2} y={-imageSize / 2 - 3}
      width={imageSize} height={imageSize} preserveAspectRatio={kind === "champion" ? "xMidYMid slice" : "xMidYMid meet"}
      clipPath={`url(#gate-face-${id})`} onError={() => setFailed(previous => [...previous, image.src])}/>)}
    {kind === "rarity" && <text className={styles.gateStars} y="6" textAnchor="middle">{visual?.rarity ?? ""}★</text>}
    {images.length > 1 && <text className={styles.gateAlternative} x="0" y="19" textAnchor="middle">{kind === "resource" ? "+" : "or"}</text>}
    {showCaption && <>
      <Fallback x={-half + 9} y="-18" width="18" height="18" className={styles.gateSymbol}/>
      <text className={styles.gateCaption} textAnchor="middle">{lines.map((line, index) => <tspan key={index} x="12" y={-9 - (lines.length - 1) * 5 + index * 11}>{line}{index < lines.length - 1 ? " " : ""}</tspan>)}</text>
    </>}
    {visual?.rarity && kind !== "rarity" ? <g className={styles.gateRarity}><rect x="-16" y="-35" width="32" height="16" rx="5"/><text x="0" y="-23" textAnchor="middle">{visual.rarity}★</text></g> : null}
    {visual?.countLabel && <g className={styles.gateCount}><rect x={-half + 4} y="18" width={Math.max(27, visual.countLabel.length * 7 + 12)} height="18" rx="5"/><text x={-half + 10} y="31">{visual.countLabel}</text></g>}
    <g data-gate-lock transform={`translate(${half - 10} 14)`} className={styles.gateLock}><circle r="8"/><path d="M-3-1v-3a3 3 0 0 1 6 0v3M-5-1h10v7H-5ZM0 1v3"/></g>
    <path className={styles.focusRing} d={`M${-half + 4}-34H${half - 4}L${half + 5}-25V25L${half - 4}34H${-half + 4}L${-half - 5}25V-25Z`}/>
  </g>;
}

export function questGateMarkerWidth(gate: QuestGateView, imageCount = gate.visual?.images.length ?? 0): number {
  if (!gate.resolved || !imageCount && gate.visual?.kind !== "rarity") return 136;
  return imageCount > 1 ? 88 : 54;
}
