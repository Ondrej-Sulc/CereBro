import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react"
import styles from "./crystal-category-layout.module.css"

/** Normal acquisition categories only. Hosts own filtering, previews and controls. */
export function CrystalCategoryLayout({ children }: { children: ReactNode }) {
  return <div className={styles.container}><div className={styles.groups} data-crystal-category-layout>{children}</div></div>
}

type Props = ComponentPropsWithoutRef<"section"> & { visibleFamilyCount: number }

export function CrystalCategoryBlock({ visibleFamilyCount, className, style, ...props }: Props) {
  // Use only already-rendered families, never full-pool metadata. A collapsed
  // category still needs room for its heading and expansion action.
  const columns = Math.max(1, Math.min(4, visibleFamilyCount))
  const preferredWidth = Math.max(280, columns * 230 + (columns - 1) * 12)
  return <section {...props} className={[styles.category, className].filter(Boolean).join(" ")}
    data-category-size={columns === 1 ? "small" : "multiple"}
    style={{ "--category-preferred-width": `${preferredWidth}px`, ...style } as CSSProperties} />
}
