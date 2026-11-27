"use client";
import { useMemo, useState, useTransition, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Gem, Plus, Pencil, Trophy } from "lucide-react";
import { CollectionHeading, useCollectionState } from "@/components/collections/collection-navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { profilePrimaryActionClass } from "@/components/player-profile-ui";
import type { ChampionClass } from "@prisma/client";
import type { RelicCatalogData } from "@/lib/data/relics";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { useRelicInventory } from "@/components/relics/relic-inventory";
import {
  DEFAULT_RELIC_FILTERS,
  RelicCatalogFilters,
} from "@/app/relics/relic-catalog-filters";
import { switchProfile } from "../actions";
import { RelicCollectionSummary } from "@/components/relics/relic-prestige-panel";
import { RelicScreenshotImport } from "@/components/relics/relic-screenshot-import";
import styles from "./player-relics.module.css";

export function PlayerRelics({
  catalog,
  avatar,
  profiles,
}: {
  catalog: RelicCatalogData;
  avatar?: string | null;
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
      <CollectionHeading />
      <RelicCollectionSummary
        identity={profile && (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-12 shrink-0 rounded-xl border border-indigo-300/30 bg-indigo-400/10 text-indigo-100 sm:size-14">
              <AvatarImage src={avatar || undefined} alt="" />
              <AvatarFallback className="rounded-xl bg-indigo-400/15 font-semibold">{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl">{profile.name}</h2>
              {profiles.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" disabled={switching} className="h-8 gap-1 px-0 text-xs text-slate-300 hover:bg-transparent hover:text-white">
                      Switch profile <ChevronDown className="size-3" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52 border-slate-700 bg-slate-900 text-slate-100">
                    {profiles.map((option) => (
                      <DropdownMenuItem key={option.id} onSelect={() => {
                        if (option.id !== profile.id) changeProfile(option.id);
                      }}>
                        <span className="min-w-0 flex-1 break-words">{option.name}</span>
                        {option.id === profile.id && <span className="text-xs text-indigo-200">Active</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )}
        actions={<>
          <RelicScreenshotImport disabled={switching} attributeIcons={catalog.attributeIcons} />
          <button type="button" className={profilePrimaryActionClass} disabled={switching} onClick={() => openEditor()}>
            <Plus size={17} aria-hidden="true" /> Add relics
          </button>
        </>}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
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
            controls={
              <div className={styles.toolbar}>
                <button type="button" className={styles.topFilter} aria-pressed={topOnly} onClick={() => setTopOnly(!topOnly)}>
                  <Trophy size={14} aria-hidden /> Top 30 contributors
                </button>
                <select aria-label="Rarity" value={stars} onChange={(event) => setStars(event.target.value)}>
                  <option value="all">All rarities</option>
                  {[...new Set(entries.map((r) => r.stars))]
                    .sort((a, b) => b - a)
                    .map((n) => (
                      <option key={n} value={n}>{n}★</option>
                    ))}
                </select>
                <select aria-label="Sort by" value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="rarity">Rarity &amp; rank</option>
                  <option value="prestige">Prestige</option>
                  <option value="name">Name</option>
                </select>
              </div>
            }
          />
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
