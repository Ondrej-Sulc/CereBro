import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getGroupArtwork } from "@cerebro/core/data/game-quests/artwork";
import { getGroupMenuArtwork } from "@cerebro/core/data/game-quests/menu-art";
import type { QuestSummary } from "@cerebro/core/domain/game-quests";
import styles from "./quest-catalog.module.css";

export function QuestArtworkCard({ quests, label, eyebrow, href, scope }: { quests: QuestSummary[]; label: string; eyebrow: string; href: string; scope?: { kind: "act" | "chapter"; id: string } }) {
  const menu = getGroupMenuArtwork(quests, scope);
  const art = menu ?? getGroupArtwork(quests);
  const maps = quests.filter(q => q.coverage === "full-map").length;
  return <a href={href} className={styles.artCard} data-menu-art={Boolean(menu)}>
    <div className={styles.artImage}>{art && <Image src={art.url} alt="" fill sizes="(max-width:600px) 45vw, (max-width:1000px) 30vw, 230px" />}<div className={styles.imageShade}/><span className={styles.cardEyebrow}>{eyebrow}</span><ArrowUpRight size={17} className={styles.cardArrow}/></div>
    <div className={styles.cardCopy}><h3>{label}</h3><p>{quests.length} {quests.length===1 ? "quest" : "quests"} <span>·</span> {maps ? `${maps} ${maps === 1 ? "layout" : "layouts"}` : "Summaries"}</p>{!menu && art && <small className={styles.terrainLabel}>Terrain preview</small>}</div>
  </a>;
}
