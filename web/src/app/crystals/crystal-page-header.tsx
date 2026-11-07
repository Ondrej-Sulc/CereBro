import Link from "next/link"
import { ArrowDown, Gem, Gift, Users } from "lucide-react"
import type { CrystalAvailability } from "@cerebro/core/domain/crystal-availability"
import { CrystalArtwork, CrystalBanner } from "./crystal-artwork"
import { CrystalAvailabilitySummary } from "./crystal-availability"
import { SourceNote } from "./crystal-shared"
import styles from "./crystal-detail-page.module.css"

type Opening = { label: string; description: string; href: string; current: boolean }
type Props = {
  name: string; category?: string; edition?: string | null; artwork?: string | null; banner?: string | null
  championCount?: number; rarities?: number[]; rewardCount: number; openings?: Opening[]
  observedAt: string; ratesObservedAt?: string | null; firstRecordedAt?: string | null
  availability?: CrystalAvailability | null; as?: "section" | "header"
}
const title = (name: string) => name === name.toLocaleUpperCase("en")
  ? name.toLocaleLowerCase("en").replace(/\b[a-z]/g, letter => letter.toUpperCase()).replace(/Iso-8/g, "ISO-8") : name
const stars = (values: number[]) => values.length === 1 ? `${values[0]}★` : `${Math.min(...values)}–${Math.max(...values)}★`

export function CrystalPageHeader({ name, category, edition, artwork, banner, championCount = 0, rarities = [], rewardCount, openings = [], observedAt, ratesObservedAt, firstRecordedAt, availability, as: Element = "section" }: Props) {
  return <Element className={styles.hero} aria-labelledby="crystal-title">
    <div className={styles.heroTop} data-banner={!!banner}>
      {banner && <div className={styles.banner}><CrystalBanner src={banner} name={name} /></div>}
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{category ?? "Crystal collection"}{edition && <span>{edition}</span>}</p>
        <h1 id="crystal-title" aria-label={name}>{title(name)}</h1>
        <div className={styles.facts}>
          {rarities.length > 0 && <span className={styles.starFact}>{stars(rarities)}</span>}
          {championCount > 0 && <a href="#champion-pool-title"><Users aria-hidden="true" /><strong>{championCount.toLocaleString("en")}</strong>{championCount === 1 ? "champion" : "champions"}<ArrowDown aria-hidden="true" /></a>}
          {rewardCount > 0 && <a href="#crystal-other-rewards" title={`${rewardCount} recorded reward categories`}><Gift aria-hidden="true" /><strong>{rewardCount}</strong>reward types<ArrowDown aria-hidden="true" /></a>}
        </div>
      </div>
      <div className={styles.crystal}><CrystalArtwork primary={artwork} /></div>
    </div>
    <div className={styles.heroFooter}>
      {openings.length > 0 && <dl className={styles.openings} aria-label="Opening options">{openings.map(option => <div key={option.label} data-active={option.current || undefined}>
        <dt><Link prefetch={false} href={option.href} aria-current={option.current ? "page" : undefined}><Gem aria-hidden="true" />{option.label}</Link></dt>{option.description && <dd>{option.description}</dd>}
      </div>)}</dl>}
      {availability && availability.status !== "unverified" && <CrystalAvailabilitySummary availability={availability} compact />}
      <SourceNote observedAt={observedAt} ratesObservedAt={ratesObservedAt} firstRecordedAt={firstRecordedAt} />
    </div>
  </Element>
}

export function CrystalPageSections({ sections }: { sections: { id: string; label: string; count?: number; kind: "champions" | "rewards" | "rules" }[] }) {
  if (sections.length < 2) return null
  return <nav className={styles.sectionNav} aria-label="Crystal page sections"><span>On this page</span>{sections.map(section => <a key={section.id} href={`#${section.id}`}>
    {section.kind === "champions" ? <Users aria-hidden="true" /> : section.kind === "rewards" ? <Gift aria-hidden="true" /> : <Gem aria-hidden="true" />}{section.label}{section.count !== undefined && <span>{section.count.toLocaleString("en")}</span>}
  </a>)}</nav>
}
