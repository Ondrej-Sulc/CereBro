import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { getGroupMenuArtwork } from "@cerebro/core/data/game-quests/menu-art";
import type { QuestSummary } from "@cerebro/core/domain/game-quests";
import styles from "./quest-catalog.module.css";

type Chapter = { id: string; label: string; index: number; quests: QuestSummary[] };

export function QuestChapterPanorama({ chapters, href }: {
  chapters: Chapter[];
  href: (id: string) => string;
}) {
  if (!chapters.length) return null;

  return <>
    {chapters.length > 1 && <p className={styles.panoramaHint}>Swipe to explore the chapters <span aria-hidden="true">→</span></p>}
    <nav className={styles.chapterViewport} aria-label="Story chapters" data-single-chapter={chapters.length === 1}>
      <div className={styles.chapterRail} style={{ "--chapter-count": chapters.length } as CSSProperties}>
        {chapters.map(chapter => {
          const art = getGroupMenuArtwork(chapter.quests, { kind: "chapter", id: chapter.id });
          return <Link key={chapter.id} href={href(chapter.id)} className={styles.chapterPanel} data-chapter-index={chapter.index}>
            <div className={styles.chapterArtwork} aria-hidden="true">
              {art
                ? <Image src={art.url} alt="" fill sizes="(max-width:600px) 50vw, 270px" className={styles.panoramaImage} />
                : <div className={styles.noChapterArt} />}
            </div>
            <div className={styles.chapterScrim} aria-hidden="true" />
            <span className={styles.chapterNumber}><span className="sr-only">Chapter </span>{String(chapter.index).padStart(2, "0")}</span>
            <div className={styles.chapterCaption}>
              <h3>{chapter.label}</h3>
              <div className={styles.chapterMeta}>
                <span>{chapter.quests.length} {chapter.quests.length === 1 ? "quest" : "quests"}</span>
                <span className={styles.chapterAction} aria-hidden="true"><ArrowRight size={16} /></span>
              </div>
            </div>
          </Link>;
        })}
      </div>
    </nav>
  </>;
}
