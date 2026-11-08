import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowUpRight, BookOpen, Compass, Gem, LayoutGrid, Search, Sparkles, Users } from "lucide-react";
import type { HomeFeaturedChampion } from "@/lib/data/home-featured-champions";
import type { HomeFeaturedRelic } from "@/lib/data/home-featured-relics";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { HomeChampionSearch } from "./HomeChampionSearch";
import styles from "./home-discovery.module.css";

// Published game artwork, verified against the canonical catalog. Keep this small
// editorial selection independent of the full catalog and its client payloads.
const artwork = {
  crystal: "https://storage.googleapis.com/champion-images/crystals/primary/69c6268cae87e327d40024f589d94fa25d4fc507ae4bf8c2c0145c84ef7d85ca.webp",
};

const championTopics = [
  { label: "Kit overview", tab: "overview", icon: LayoutGrid },
  { label: "Full abilities", tab: "abilities", icon: BookOpen },
  { label: "Synergies", tab: "synergies", icon: Users },
  { label: "Stats & attacks", tab: "stats", icon: Activity },
  { label: "How to obtain", tab: "crystals", icon: Compass },
];

export function HomeDiscovery({ featuredChampions, featuredRelics }: { featuredChampions: HomeFeaturedChampion[]; featuredRelics: HomeFeaturedRelic[] }) {
  const primaryChampion = featuredChampions[0];
  return (
    <section id="explore" aria-labelledby="explore-title" className={styles.explore}>
      <div className={styles.container}>
        <div className={styles.sectionHeading}>
          <div><p className={styles.sectionBadge}><BookOpen aria-hidden="true" /> Game reference</p><h2 id="explore-title">Champions, crystals &amp; relics</h2></div>
          <p>Read champion kits, inspect crystal pools and compare relics. Public catalogs, no sign-in needed.</p>
        </div>
        <div className={styles.discoveryGrid}>
          <article className={styles.championFeature}>
            <h3><BookOpen aria-hidden="true" />Champion pages</h3>
            <p>Filter the catalog by abilities and immunities, then open a champion to explore their kit and build.</p>
            <HomeChampionSearch />
            {primaryChampion && <p className={styles.topicContext}>Inside {primaryChampion.name}</p>}
            <ul className={styles.championTopics} aria-label={primaryChampion ? `${primaryChampion.name} detail sections` : "Champion page sections"}>
              {championTopics.map(({ label, tab, icon: Icon }) => <li key={tab}>{primaryChampion ? <Link href={`${primaryChampion.href}?tab=${tab}`} prefetch={false} className={styles.topicItem} aria-label={`${label} for ${primaryChampion.name}`}><Icon aria-hidden="true" /><span>{label}</span><ArrowUpRight aria-hidden="true" className={styles.directionArrow} /></Link> : <span className={styles.topicItem}><Icon aria-hidden="true" /><span>{label}</span></span>}</li>)}
            </ul>
            <Link href="/champions?view=catalog" prefetch={false} className={styles.primaryLink}>Explore champion pages <ArrowUpRight aria-hidden="true" className={styles.directionArrow} /></Link>
            {!!featuredChampions.length && <div className={styles.featuredChampions}><h4>Featured champions</h4><div>{featuredChampions.map(champion => {
              const colors = getChampionClassColors(champion.championClass ?? undefined);
              return <Link key={champion.href} href={champion.href} prefetch={false}><span className={styles.featuredPortrait} style={{ borderColor: champion.championClass ? `${colors.color}b3` : undefined }}><Image src={champion.portraitUrl} alt="" width={40} height={40} sizes="36px" /></span><span>{champion.name}</span><ArrowUpRight aria-hidden="true" className={styles.directionArrow} /></Link>;
            })}</div></div>}
            {primaryChampion && <Image src={primaryChampion.artworkUrl} alt="" fill sizes="(min-width: 1024px) 24vw, (min-width: 640px) 42vw, 55vw" className={styles.featureChampionArt} />}
          </article>
          <article className={`${styles.catalogFeature} ${styles.crystalFeature}`}>
            <Image src={artwork.crystal} alt="" width={152} height={152} className={styles.catalogArt} sizes="(min-width: 640px) 124px, 82px" />
            <div><h3><Gem aria-hidden="true" />Crystal catalog</h3>
              <p>Explore champion pools, materials and mixed rewards. Filter the catalog and inspect recorded category rates where captured.</p>
              <Link href="/crystals" prefetch={false} className={styles.textLink}>Browse crystals <ArrowUpRight aria-hidden="true" className={styles.directionArrow} /></Link>
            </div>
          </article>
          <article className={`${styles.catalogFeature} ${styles.relicFeature}`}>
            <div className={styles.relicArtwork}>{featuredRelics.map(relic => <Link key={relic.type} href={relic.href} prefetch={false} aria-label={`Explore ${relic.name}`} title={relic.name}><Image src={relic.artworkUrl} alt="" width={84} height={84} sizes="(min-width: 640px) 84px, 64px" /><span>{relic.type === "battlecast" ? "Battlecast" : "Statcast"}</span></Link>)}</div>
            <div><h3><Sparkles aria-hidden="true" />Relics</h3>
              <p>Explore Battlecasts and Statcasts. Compare rarities and variants, inspect abilities, runes and attributes, and see game-recommended champions.</p>
              <Link href="/relics?view=catalog" prefetch={false} className={styles.textLink}>Explore relics <ArrowUpRight aria-hidden="true" className={styles.directionArrow} /></Link>
            </div>
          </article>
          <article className={styles.finderFeature}>
            <div className={styles.finderIcon}><Search aria-hidden="true" /></div>
            <div className={styles.finderCopy}><h3>How to get a champion</h3><p>Choose a star level to discover recorded crystal pools, quests, events, exchanges and seven-star Ascension sources.</p></div>
            <div className={styles.finderLinks}><Link href="/crystals/champions" prefetch={false} className={styles.primaryLink}>Find sources <ArrowUpRight aria-hidden="true" className={styles.directionArrow} /></Link><Link href="/crystals/champions?reward=ascension&rarity=7" prefetch={false} className={styles.textLink}>Explore 7-star Ascension <ArrowUpRight aria-hidden="true" className={styles.directionArrow} /></Link></div>
          </article>
        </div>
        <p className={styles.catalogNote}>Recorded sources include historical definitions. Listings do not establish current store availability; category rates are not individual champion odds.</p>
      </div>
    </section>
  );
}
