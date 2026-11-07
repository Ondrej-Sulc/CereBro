import Link from "next/link"
import type { ReactNode } from "react"
import { Gem, Search } from "lucide-react"
import styles from "./crystal-tools.module.css"

type CrystalTool = "browse" | "compare" | "champions"

export function CrystalToolsHeader({ active, children }: { active: CrystalTool; children: ReactNode }) {
  return <header>{children}<CrystalToolsNav active={active} /></header>
}

export function CrystalToolsNav({ active }: { active: CrystalTool }) {
  // Comparison remains reachable from details; neither primary link is current there.
  return <nav className={styles.toolsNav} aria-label="Crystal tools">
    <Link href="/crystals" aria-current={active === "browse" ? "page" : undefined}><Gem aria-hidden="true" /><span>Browse crystals</span></Link>
    <Link href="/crystals/champions" aria-current={active === "champions" ? "page" : undefined}><Search aria-hidden="true" /><span>Find a champion</span></Link>
  </nav>
}
