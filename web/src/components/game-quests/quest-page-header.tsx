import Image from "next/image";
import { getQuestMenuArtwork } from "@cerebro/core/data/game-quests/menu-art";
import { hierarchyLabel, type QuestSummary } from "@cerebro/core/domain/game-quests";
import { questDifficulty } from "@cerebro/core/domain/game-quests/browse";
import { questCatalog } from "@cerebro/core/data/game-quests";
import styles from "./quest-page-header.module.css";

export function QuestPageHeader({ quest: q }: { quest: QuestSummary }) {
  const art = getQuestMenuArtwork(q);
  const showChapter=q.section!=="Special"||new Set(questCatalog.filter(other=>other.containerSetId===q.containerSetId).flatMap(other=>other.hierarchy.map(h=>h.chapterId))).size>1;
  return <header className={styles.header} data-has-art={Boolean(art)} data-menu-art-role={art?.role ?? "none"}>
    {art && <><Image className={styles.ambience} src={art.url} alt="" fill sizes="(max-width:1280px) 100vw, 1280px" priority/><div className={styles.shade}/><div className={styles.poster}><Image src={art.url} alt="" fill sizes="(max-width:600px) 40vw, 260px" priority/></div></>}
    <div className={styles.copy}><p className={styles.eyebrow}>{q.section === "Special" ? "Special quest" : q.section ?? q.category} · {hierarchyLabel(q)}{questDifficulty(q) && ` · ${questDifficulty(q)}`}</p><h1>{q.name}</h1><p className={styles.location}>{q.hierarchy.map(h => [h.actName !== "-" ? h.actName : "", showChapter?h.chapterName:""].filter(Boolean).join(" / ")).join(" · ")}</p>{art && <span className={styles.role}>{art.label}</span>}</div>
  </header>;
}
