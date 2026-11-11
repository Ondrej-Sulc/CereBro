import type { CSSProperties } from "react"
import { resolveNativeGameModifierIcon } from "@cerebro/core/domain/node-modifiers/native-game-icons"

/** Native game glyph; adjacent modifier text supplies its accessible name. */
export function GameNodeModifierIcon({ iconKey, size = 16, className }: { iconKey?: string | null; size?: number; className?: string }) {
  const icon = resolveNativeGameModifierIcon(iconKey)
  if (!icon) return null
  const pixels = Number.isFinite(size) && size > 0 && size <= 64 ? size : 16
  const style: CSSProperties = { display: "inline-block", flexShrink: 0, width: pixels, height: pixels,
    backgroundColor: "currentColor", maskImage: `url("${icon.src}")`, WebkitMaskImage: `url("${icon.src}")`,
    maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
    maskPosition: "center", WebkitMaskPosition: "center", verticalAlign: "middle" }
  return <span aria-hidden="true" data-native-modifier-icon data-game-modifier-icon={icon.key} className={className} style={style} />
}
