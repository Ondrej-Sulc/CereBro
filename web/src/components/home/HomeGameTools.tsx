import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass, Gift } from "lucide-react";
import styles from "./home-discovery.module.css";

// Existing Act 6, Crucible, and Act 8 posters from the public quest artwork manifest.
const questPosters = [
  "/game-quests/menu-art/8b80bd8514f67056d38454e49523969a60d09cdb1234695524d861ba8106cf05.webp",
  "/game-quests/menu-art/41fa73c0fb838e4cd826889f24d995a5e36693564179fd896d8e93ebe5cd7e19.webp",
  "/game-quests/menu-art/ebc6ae8828d497b7f58c182cb648578f1ba5789150c15622baaadd12346402ab.webp",
];

const rewardArtwork = [
  "/game-rewards/resource-definitions/d05f985572790b26df7965d8c1d66715ead3e889ef010d9a411f96e72e4f4f61.png",
  "/game-rewards/resource-definitions/85de8eea25c67848a32f3b781df3da50dd561979191f09a5729cd761c7455ab3.png",
];

export function HomeGameTools() {
  return (
    <section id="game-tools" aria-labelledby="game-tools-title" className={styles.gameTools}>
      <div className={styles.container}>
        <div className={styles.gameToolsHeading}>
          <h2 id="game-tools-title">Explore the Battlerealm</h2>
          <p>No sign-in needed</p>
        </div>
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
              <Link href="/quests" prefetch={false} className={styles.primaryLink}>
                Explore quests <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </article>
          <article className={`${styles.gameTool} ${styles.glossaryTool}`}>
            <div className={styles.effectArtwork} aria-hidden="true">
              {["armor_up", "bleed", "regeneration"].map(effect => (
                <Image key={effect} src={`https://storage.googleapis.com/champion-images/mcoc/glossary-icons/${effect}.svg`}
                  alt="" width={32} height={32} unoptimized />
              ))}
            </div>
            <div className={styles.smallToolCopy}>
              <h3><BookOpen aria-hidden="true" />Effect Glossary</h3>
              <p>Look up an effect to find champions who apply it, resist it or are immune to it.</p>
              <Link href="/glossary" prefetch={false} className={styles.textLink}>
                Find effects and counters <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </article>
          <article className={`${styles.gameTool} ${styles.rewardTool}`}>
            <div className={styles.rewardArtwork} aria-hidden="true">
              {rewardArtwork.map(src => <Image key={src} src={src} alt="" width={60} height={60} />)}
            </div>
            <div className={styles.smallToolCopy}>
              <h3><Gift aria-hidden="true" />Find a Reward</h3>
              <p>Search for a catalyst, crystal or rank-up gem to see which quests and Towers offer it.</p>
              <Link href="/rewards" prefetch={false} className={styles.textLink}>
                Search rewards <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
