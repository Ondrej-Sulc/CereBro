"use client";
import { useMemo, useState, useTransition, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gem, Plus, Pencil, Trophy } from "lucide-react";
import { CollectionHeading, useCollectionState } from "@/components/collections/collection-navigation";
import type { ChampionClass } from "@prisma/client";
import type { RelicCatalogData } from "@/lib/data/relics";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { useRelicInventory } from "@/components/relics/relic-inventory";
import {
  DEFAULT_RELIC_FILTERS,
  RelicCatalogFilters,
} from "@/app/relics/relic-catalog-filters";
import { switchProfile } from "../actions";
import { RelicPrestigePanel } from "@/components/relics/relic-prestige-panel";
import { RelicScreenshotImport } from "@/components/relics/relic-screenshot-import";
import styles from "./player-relics.module.css";

export function PlayerRelics({
  catalog,
  profiles,
}: {
  catalog: RelicCatalogData;
  profiles: { id: string; name: string }[];
}) {
  const { profile, entries, prestige, openEditor } = useRelicInventory();
  const [specificFilters, setSpecificFilters] = useCollectionState("filters", DEFAULT_RELIC_FILTERS);
  const [query, setQuery] = useCollectionState("search", "", true);
  const [className, setClassName] = useCollectionState("classes", "all", true);
  const filters = useMemo(() => ({ ...specificFilters, query, className }), [specificFilters, query, className]);
  const setFilters = (next: typeof filters) => { setSpecificFilters(next); setQuery(next.query); setClassName(next.className); };
  const [stars, setStars] = useCollectionState("stars", "all");
  const [topOnly, setTopOnly] = useCollectionState("top30", false);
  const contributorRanks = useMemo(() => new Map(prestige?.contributorIds.map((id, index) => [id, index + 1]) ?? []), [prestige]);
  const [sort, setSort] = useCollectionState("sort", "rarity");
  const [error, setError] = useState("");
  const [switching, startTransition] = useTransition();
  const router = useRouter();
  const visible = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            (!topOnly || contributorRanks.has(entry.id)) &&
            (filters.type === "all" || entry.type === filters.type) &&
            (filters.className === "all" ||
              entry.className.toLowerCase() ===
                filters.className.toLowerCase()) &&
            (filters.attribute === "all" ||
              entry.primaryAttribute === filters.attribute ||
              entry.secondaryAttribute === filters.attribute) &&
            (stars === "all" || entry.stars === Number(stars)) &&
            `${entry.shortName} ${entry.name} ${entry.primaryAttribute ?? ""} ${entry.secondaryAttribute ?? ""}`
              .toLowerCase()
              .includes(filters.query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "prestige"
            ? (b.prestige ?? -1) - (a.prestige ?? -1)
            : sort === "name"
              ? a.shortName.localeCompare(b.shortName)
              : b.stars - a.stars || b.rank - a.rank || b.sigLevel - a.sigLevel,
        ),
    [entries, filters, stars, sort, topOnly, contributorRanks],
  );
  const changeProfile = (id: string) =>
    startTransition(async () => {
      try {
        const result = await switchProfile(id);
        if (result.error) throw new Error(result.error);
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not switch profiles.",
        );
      }
    });
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <CollectionHeading />
          <div className={styles.profile}>
            {profiles.length > 1 ? (
              <label>
                Profile
                <select
                  aria-label="Game profile"
                  value={profile!.id}
                  disabled={switching}
                  onChange={(event) => changeProfile(event.target.value)}
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p>{profile!.name}’s Battlecasts &amp; Statcasts</p>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          <RelicScreenshotImport disabled={switching} attributeIcons={catalog.attributeIcons} />
          <button
            className={styles.primary}
            disabled={switching}
            onClick={() => openEditor()}
          >
            <Plus size={17} /> Add relics
          </button>
        </div>
      </header>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <RelicPrestigePanel />
      {!!entries.length && (
        <>
          <RelicCatalogFilters
            data={catalog}
            filters={filters}
            onChange={setFilters}
            visibleFamilies={0}
            visibleVariants={0}
            ownedTypeCounts={{
              all: entries.length,
              battlecast: entries.filter((entry) => entry.type === "battlecast")
                .length,
              statcast: entries.filter((entry) => entry.type === "statcast")
                .length,
            }}
            resultSummary={
              <>
                <strong>{visible.length}</strong> of {entries.length} owned
                relics
              </>
            }
          />
          <div className={styles.toolbar}>
            <button className={styles.topFilter} aria-pressed={topOnly} onClick={() => setTopOnly(!topOnly)}>
              <Trophy size={14} aria-hidden /> Top 30 contributors
            </button>
            <label>
              Rarity
              <select
                value={stars}
                onChange={(event) => setStars(event.target.value)}
              >
                <option value="all">All rarities</option>
                {[...new Set(entries.map((r) => r.stars))]
                  .sort((a, b) => b - a)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}★
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Sort by
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="rarity">Rarity &amp; rank</option>
                <option value="prestige">Prestige</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
        </>
      )}
      {visible.length ? (
        <div className={styles.grid}>
          {visible.map((entry) => (
            <article
              key={entry.id}
              className={styles.card}
              style={
                {
                  "--class-color": getChampionClassColors(
                    entry.className as ChampionClass,
                  ).color,
                } as CSSProperties
              }
            >
              <Link
                className={styles.cardLink}
                href={`/relics/${entry.slug}?rarity=${entry.stars}&rank=${entry.rank}&sig=${entry.sigLevel}`}
              >
                <div className={styles.cardTop}>
                  <span>{entry.className.toLowerCase()}</span>
                  <span>
                    {entry.type === "battlecast" ? "Battlecast" : "Statcast"}
                  </span>
                </div>
                <div className={styles.portrait}>
                  <Image
                    src={entry.portraitPath}
                    alt=""
                    width={160}
                    height={160}
                    sizes="(max-width: 700px) 105px, 150px"
                  />
                </div>
                <h2>{entry.shortName}</h2>
                <p className={styles.attributes}>
                  {entry.type === "statcast" ? (
                    <>
                      <strong>{entry.primaryAttribute}</strong>
                      <span>{entry.secondaryAttribute}</span>
                    </>
                  ) : (
                    "Striker & innate ability"
                  )}
                </p>
                <div className={styles.build}>
                  <span>{entry.stars}★</span>
                  <span>Rank {entry.rank}</span>
                  <span title={entry.sigLevel ? `Signature level ${entry.sigLevel}` : "Unawakened"}>
                    {`Sig ${entry.sigLevel}`}
                  </span>
                </div>
                <div className={styles.rating}>
                  <span>
                    <Trophy size={14} /> {contributorRanks.has(entry.id) ? `Top 30 · #${contributorRanks.get(entry.id)}` : "Prestige"}
                  </span>
                  <strong>
                    {entry.prestige?.toLocaleString("en-US") ?? "—"}
                  </strong>
                </div>
              </Link>
              {!entry.current && (
                <p className={styles.retired}>
                  No longer in the current catalog. Your saved build is
                  preserved.
                </p>
              )}
              <button
                className={styles.edit}
                disabled={switching}
                onClick={() => openEditor({ entry })}
              >
                <Pencil size={14} />
                {entry.current ? "Edit build" : "Manage saved relic"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <Gem size={40} />
          <h2>
            {entries.length
              ? "No relics match your filters"
              : "Your collection starts here"}
          </h2>
          <p>
            {entries.length
              ? "Try a different name, class, rarity or attribute."
              : "Add your first relic, then keep its rank and signature up to date."}
          </p>
          <button
            className={styles.primary}
            onClick={() =>
              entries.length
                ? (setFilters(DEFAULT_RELIC_FILTERS), setStars("all"), setTopOnly(false))
                : openEditor()
            }
          >
            {entries.length ? "Clear filters" : "Add your first relic"}
          </button>
        </div>
      )}
    </div>
  );
}
