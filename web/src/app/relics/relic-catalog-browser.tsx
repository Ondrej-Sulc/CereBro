"use client";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { CollectionHeading, useCollectionState } from "@/components/collections/collection-navigation";
import { filterRelicFamilies } from "@cerebro/core/domain/relic-catalog";
import type { RelicCatalogData } from "@/lib/data/relics";
import styles from "./relics.module.css";
import { RelicCatalogCards } from "./relic-catalog-cards";
import {
  DEFAULT_RELIC_FILTERS,
  RelicCatalogFilters,
} from "./relic-catalog-filters";
export function RelicCatalogBrowser({ data }: { data: RelicCatalogData }) {
  const [specificFilters, setSpecificFilters] = useCollectionState("filters", DEFAULT_RELIC_FILTERS);
  const [query, setQuery] = useCollectionState("search", "", true);
  const [className, setClassName] = useCollectionState("classes", "all", true);
  const filters = useMemo(() => ({ ...specificFilters, query, className }), [specificFilters, query, className]);
  const setFilters = (next: typeof filters) => { setSpecificFilters(next); setQuery(next.query); setClassName(next.className); };
  const visible = useMemo(
    () => filterRelicFamilies(data.families, filters),
    [data.families, filters],
  );
  const changed = Object.entries(filters).some(
    ([key, value]) =>
      value !==
      DEFAULT_RELIC_FILTERS[key as keyof typeof DEFAULT_RELIC_FILTERS],
  );
  return (
    <div className={styles.page}>
      <header className={styles.catalogHeader}>
        <div>
          <CollectionHeading />
          <p>
            Explore Battlecasts, Statcasts and the abilities behind every
            pairing.
          </p>
        </div>
        <dl className={styles.catalogNumbers}>
          <div>
            <dt>Relic families</dt>
            <dd>{data.families.length}</dd>
          </div>
          <div>
            <dt>Variants</dt>
            <dd>{data.variants}</dd>
          </div>
        </dl>
      </header>
      <RelicCatalogFilters
        data={data}
        filters={filters}
        onChange={setFilters}
        visibleFamilies={visible.length}
        visibleVariants={visible.reduce(
          (count, family) => count + family.variants.length,
          0,
        )}
      />
      {visible.length ? (
        <RelicCatalogCards
          families={visible}
          attributeIcons={data.attributeIcons}
        />
      ) : (
        <div className={styles.empty}>
          <Sparkles size={30} />
          <h2>
            {data.families.length
              ? "No relics match these filters"
              : "The relic catalog is not available yet"}
          </h2>
          <p>
            {data.families.length
              ? "Try a different class, attribute or search."
              : "Check back after the next catalog update."}
          </p>
          {changed && (
            <button onClick={() => setFilters(DEFAULT_RELIC_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>
      )}
      {data.generatedAt && (
        <footer className={styles.sourceNote}>
          Catalog snapshot ·{" "}
          {new Date(data.generatedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          . Listed definitions and supported rarities are a reference, not a
          live crystal-availability feed.
        </footer>
      )}
    </div>
  );
}
