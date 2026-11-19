import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass } from "lucide-react";
import styles from "./home-discovery.module.css";

// Existing Act 6, Crucible, and Act 8 posters from the public quest artwork manifest.
const questPosters = [
  "/game-quests/menu-art/8b80bd8514f67056d38454e49523969a60d09cdb1234695524d861ba8106cf05.webp",
  "/game-quests/menu-art/41fa73c0fb838e4cd826889f24d995a5e36693564179fd896d8e93ebe5cd7e19.webp",
  "/game-quests/menu-art/ebc6ae8828d497b7f58c182cb648578f1ba5789150c15622baaadd12346402ab.webp",
];

const effectSearches = [
  { icon: "bleed", name: "Bleed" },
  { icon: "armor_up", name: "Armor Up" },
  { icon: "regeneration", name: "Regeneration" },
];

export function HomeGameTools() {
  return (
    <section id="game-tools" aria-labelledby="game-tools-title" className={styles.gameTools}>
      <div className={styles.container}>
        <h2 id="game-tools-title" className={styles.gameToolsHeading}>Explore the Battlerealm</h2>
        <div className={styles.gameToolsGrid}>
          <article className={`${styles.gameTool} ${styles.questTool}`}>
            <div className={styles.questPosters} aria-hidden="true">
              {questPosters.map(src => (
                <Image key={src} src={src} alt="" width={256} height={512} sizes="(max-width: 639px) 110px, 165px" />
              ))}
            </div>
            <div className={styles.questToolCopy}>
              <span className={styles.gameToolIcon}><Compass aria-hidden="true" /></span>
              <h3>Quest Explorer</h3>
              <p>Scout Story and Special quest maps, including Act 10. Check defenders, modifiers, gates and path rewards. Browse Class, Challenge and Event Towers.</p>
              <div className={styles.questToolActions}>
                <Link href="/quests" prefetch={false} className={styles.primaryLink}>
                  Explore quests <ArrowRight aria-hidden="true" />
                </Link>
                <Link href="/rewards" prefetch={false} className={styles.sampleLink}>Find a reward</Link>
              </div>
            </div>
          </article>
          <article className={`${styles.gameTool} ${styles.glossaryTool}`}>
            <span className={styles.gameToolIcon}><BookOpen aria-hidden="true" /></span>
            <h3>Effect Glossary</h3>
            <p>Find champions who apply an effect, resist it or are immune to it.</p>
            <ul aria-label="Effect searches" className={styles.effectShortcuts}>
              {effectSearches.map(({ icon, name }) => (
                <li key={icon}>
                  <Link href={`/glossary?${new URLSearchParams({ q: name })}#effects-results`}
                    prefetch={false} data-effect={icon} className={styles.effectShortcut}>
                    <Image src={`https://storage.googleapis.com/champion-images/mcoc/glossary-icons/${icon}.svg`}
                      alt="" width={28} height={28} unoptimized />
                    <span>{name}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/glossary" prefetch={false} className={styles.textLink}>
              Browse all effects <ArrowRight aria-hidden="true" />
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
