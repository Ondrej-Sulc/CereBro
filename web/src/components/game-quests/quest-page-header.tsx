import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { getQuestMenuArtwork } from "@cerebro/core/data/game-quests/menu-art";
import { hierarchyLabel, type QuestSummary } from "@cerebro/core/domain/game-quests";
import { questDifficulty } from "@cerebro/core/domain/game-quests/browse";
import { questCatalog } from "@cerebro/core/data/game-quests";
import { permanentData } from "@cerebro/core/data/game-quests/permanent";
import styles from "./quest-page-header.module.css";

export function QuestPageHeader({ quest: q }: { quest: QuestSummary }) {
  const art = getQuestMenuArtwork(q);
  const special = q.section === "Special";
  const showChapter = !special || new Set(questCatalog.filter(other => other.containerSetId === q.containerSetId).flatMap(other => other.hierarchy.map(h => h.chapterId))).size > 1;
  const collection = permanentData.specialCollections[q.containerSetName] ?? "Special quests";
  const difficulty = questDifficulty(q);
  const location = showChapter ? [...new Set(q.hierarchy.map(h => h.chapterName).filter(name => name && name !== "-" && !/^\d+ Stars$/i.test(name)))].join(" · ") : "";
  const collectionParams = { category: "Special", collection: q.containerSetName };
  return <div className={styles.wrapper}>
    <nav className={styles.breadcrumb} aria-label="Quest location">
      <Link href="/quests"><ArrowLeft size={14} aria-hidden="true"/>Quest explorer</Link>
      {special && <><ChevronRight size={12} aria-hidden="true"/><Link href={`/quests?${new URLSearchParams(collectionParams)}`}>{collection}</Link></>}
      {q.hierarchy.map(h => <Fragment key={`${h.actId}:${h.chapterId}`}>
        {!special && <><ChevronRight size={12} aria-hidden="true"/><Link href={`/quests?${new URLSearchParams({ category: "Story", act: h.actId })}`}>Act {q.actIndex}</Link></>}
        {showChapter && <><ChevronRight size={12} aria-hidden="true"/><Link href={`/quests?${new URLSearchParams(special ? { ...collectionParams, chapter: h.chapterId } : { category: "Story", act: h.actId, chapter: h.chapterId })}`}>Chapter {q.chapterIndex}</Link></>}
      </Fragment>)}
    </nav>
    <header className={styles.header} data-has-art={Boolean(art)} data-menu-art-role={art?.role ?? "none"}>
      <div className={styles.copy}>
        <div className={styles.meta}><span>{special ? "Special quest" : q.section ?? q.category}</span>{difficulty && difficulty.toLocaleLowerCase() !== q.name.toLocaleLowerCase() && <span className={styles.difficulty}>{difficulty}</span>}</div>
        <div className={styles.heading}><span className={styles.number} data-quest-number>{hierarchyLabel(q)}</span><div><h1>{q.name}</h1>{location && <p className={styles.location}>{location}</p>}</div></div>
      </div>
      {art && <div className={styles.art}><Image src={art.url} alt="" width={art.width} height={art.height} sizes="(max-width:360px) 60px, (max-width:600px) 76px, 168px" priority/></div>}
    </header>
  </div>;
}
