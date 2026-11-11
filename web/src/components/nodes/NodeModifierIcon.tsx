import type { CSSProperties } from "react"
import { resolveNativeModifierIcon } from "@cerebro/core/domain/node-modifiers/native-icons"

/** Decorative native shape. The adjacent modifier name supplies its accessible name. */
export function NodeModifierIcon({ iconKey, size = 16, className }: { iconKey?: string | null; size?: number; className?: string }) {
  const icon = resolveNativeModifierIcon(iconKey)
  if (!icon) return null
  const pixels = Number.isFinite(size) && size > 0 && size <= 64 ? size : 16
  const style: CSSProperties = { display: "inline-block", flexShrink: 0, width: pixels, height: pixels,
    backgroundColor: "currentColor", maskImage: `url("${icon.src}")`, WebkitMaskImage: `url("${icon.src}")`,
    maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
    maskPosition: "center", WebkitMaskPosition: "center", verticalAlign: "middle" }
  return <span aria-hidden="true" data-native-modifier-icon className={className} style={style} />
}
