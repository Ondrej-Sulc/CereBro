"use client";

import { useId, useState } from "react";
import { gameText } from "@cerebro/core/domain/game-quests";
import type { UnplacedDefenderIdentity, UnplacedQuestDefenders } from "@cerebro/core/domain/game-quests/unplaced-defenders";
import { QuestPortrait } from "./quest-portrait";
import styles from "./quest-unplaced-defenders.module.css";

const INITIAL_PREVIEWS = 6;
const MORE_PREVIEWS = 12;

function NativePortrait({ identity }: { identity: UnplacedDefenderIdentity }) {
  return <QuestPortrait portrait={{ name: identity.name, imageUrl: identity.portraitUrl, href: null,
    className: "", color: "#64748b", nativeGameId: identity.gameId }} />;
}

/** Optional isolated section. Root supplies a bound DTO after loading the quest. */
type ReferenceProps = { data: UnplacedQuestDefenders };
export function QuestUnplacedDefenders({ data }: ReferenceProps) {
  return <UnplacedDefenderSection key={data.questId} data={data} />;
}

function UnplacedDefenderSection({ data }: ReferenceProps) {
  const headingId = useId();
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(INITIAL_PREVIEWS);
  const query = search.trim().toLowerCase();
  const previews = data.previews.filter(preview => [preview.identity, ...preview.candidates]
    .some(identity => gameText(identity.name).toLowerCase().includes(query)));
  const shown = previews.slice(0, visible);
  if (!data.previews.length) return null;

  return <section key={data.questId} aria-labelledby={headingId} className={styles.section} data-unplaced-defenders={data.questId}>
    <header className={styles.header}>
      <span className={styles.badge}>Placement unknown</span>
      <h2 id={headingId}>Unplaced defender previews</h2>
      <p>{data.checkedPreview?.notice ?? "The saved quest preview includes these potential defenders. Their map positions and route assignments are unknown; these entries do not guarantee fights."}</p>
      <p className={styles.grouping}>{data.rowCount} saved {data.rowCount === 1 ? "entry" : "entries"}
        {data.rowCount !== data.previews.length && ` grouped into ${data.previews.length} previews. Repeated entries share a card.`}</p>
    </header>
    {data.previews.length > INITIAL_PREVIEWS && <div className={styles.search}>
      <label htmlFor={searchId}>Find a defender preview</label>
      <input id={searchId} type="search" value={search} placeholder="Search names" onChange={event => {
        setSearch(event.target.value); setVisible(INITIAL_PREVIEWS);
      }} />
    </div>}
    <p className={styles.status} role="status">{previews.length ? `Showing ${shown.length} of ${previews.length} ${query ? "matching " : ""}previews` : "No defender previews match this name."}</p>
    <ul className={styles.grid}>
      {shown.map(preview => {
        const alternatives = preview.candidates.filter(candidate => candidate.tierId !== preview.identity.tierId);
        return <li key={preview.key} className={styles.card} data-unplaced-preview={preview.key}>
          <div className={styles.identity}><NativePortrait identity={preview.identity} /><div className={styles.name}>
            <h3>{gameText(preview.identity.name)}</h3><p>{preview.identity.rarity}★ native preview</p>
          </div></div>
          {preview.sourceEntryCount > 1 && <p className={styles.repeated}>{preview.sourceEntryCount} saved entries</p>}
          {alternatives.length > 0 && <details className={styles.alternatives}>
            <summary>Other potential identities ({alternatives.length})</summary>
            <ul>{alternatives.map((identity, candidateIndex) => <li key={`${identity.tierId}:${candidateIndex}`}>
              <NativePortrait identity={identity} /><span>{gameText(identity.name)} <small>{identity.rarity}★</small></span>
            </li>)}</ul>
          </details>}
          <details className={styles.build}><summary>Saved build</summary>
            <p>Rank {preview.rank} · Level {preview.level} · Signature {preview.signature}{preview.ascension > 0 && ` · Ascension ${preview.ascension}`}</p>
          </details>
        </li>;
      })}
    </ul>
    {previews.length > visible && <button type="button" className={styles.button} onClick={() => setVisible(count => count + MORE_PREVIEWS)}>
      Show {Math.min(MORE_PREVIEWS, previews.length - visible)} more previews
    </button>}
    {visible > INITIAL_PREVIEWS && previews.length > INITIAL_PREVIEWS && <button type="button" className={styles.less} onClick={() => setVisible(INITIAL_PREVIEWS)}>Show fewer</button>}
  </section>;
}
