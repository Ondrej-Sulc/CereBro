"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import { Check, Gem, Search, SlidersHorizontal, Swords, X } from "lucide-react";
import type { ChampionClass } from "@prisma/client";
import {
  buildRelicFamilies,
  filterRelicFamilies,
  type RelicFilters,
} from "@cerebro/core/domain/relic-catalog";
import type { OwnedRelic } from "@cerebro/core/domain/player-relics";
import type { RelicSummary } from "@/lib/data/relics";
import type { RelicAttributeIcon } from "@/lib/relic-attribute-icons";
import { getChampionClassColors } from "@/lib/championClassHelper";
import styles from "./relic-picker.module.css";

export function RelicAttributeGlyph({ icon }: { icon?: RelicAttributeIcon }) {
  return icon ? (
    <span
      className={styles.attributeIcon}
      aria-hidden="true"
      style={{
        backgroundColor: icon.color,
        mask: `url(${icon.iconUrl}) center / contain no-repeat`,
        WebkitMask: `url(${icon.iconUrl}) center / contain no-repeat`,
      }}
    />
  ) : (
    <SlidersHorizontal size={17} aria-hidden="true" />
  );
}

const classes = ["Cosmic", "Tech", "Mutant", "Skill", "Science", "Mystic"];
const types = [
  { value: "all", label: "All relics", Icon: Gem },
  { value: "battlecast", label: "Battlecasts", Icon: Swords },
  { value: "statcast", label: "Statcasts", Icon: SlidersHorizontal },
] as const;

export function RelicPicker({
  choices,
  entries,
  selectedId,
  attributeIcons,
  onChoose,
}: {
  choices: RelicSummary[];
  entries: OwnedRelic[];
  selectedId: string;
  attributeIcons: Record<string, RelicAttributeIcon>;
  onChoose: (relicId: string) => void;
}) {
  const [filters, setFilters] = useState<RelicFilters>({
    query: "",
    type: "all",
    className: "all",
    attribute: "all",
  });
  const families = useMemo(() => buildRelicFamilies(choices), [choices]);
  const visible = useMemo(
    () => filterRelicFamilies(families, filters),
    [families, filters],
  );
  return (
    <div className={styles.picker}>
      <div className={styles.search}>
        <Search size={18} aria-hidden="true" />
        <input
          aria-label="Find a relic"
          placeholder="Search by name or attribute…"
          value={filters.query}
          onChange={(event) =>
            setFilters({ ...filters, query: event.target.value })
          }
        />
        {filters.query && (
          <button
            type="button"
            aria-label="Clear relic search"
            onClick={() => setFilters({ ...filters, query: "" })}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className={styles.filters}>
        <div className={styles.types} role="group" aria-label="Relic type">
          {types.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.type === value}
              onClick={() => setFilters({ ...filters, type: value })}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <div className={styles.classes} role="group" aria-label="Relic class">
          <button
            type="button"
            aria-label="All classes"
            aria-pressed={filters.className === "all"}
            onClick={() => setFilters({ ...filters, className: "all" })}
          >
            All
          </button>
          {classes.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              title={name}
              aria-pressed={filters.className === name}
              onClick={() =>
                setFilters({
                  ...filters,
                  className: filters.className === name ? "all" : name,
                })
              }
            >
              <Image
                src={`/assets/icons/${name}.png`}
                width={21}
                height={21}
                alt=""
                unoptimized
              />
            </button>
          ))}
        </div>
      </div>
      <p className={styles.result} role="status">
        {visible.length} relic{visible.length === 1 ? "" : "s"}
        <span>Choose a portrait to set its build</span>
      </p>
      <div className={styles.grid}>
        {visible.map((family) => {
          const relic = family.variants[0];
          const owned = entries.filter((entry) =>
            family.variants.some((variant) => variant.id === entry.relicId),
          ).length;
          const selected = family.variants.some(
            (variant) => variant.id === selectedId,
          );
          const color = getChampionClassColors(
            family.className.toUpperCase() as ChampionClass,
          ).color;
          return (
            <button
              key={family.id}
              type="button"
              className={styles.card}
              aria-label={`Choose ${family.title}${relic.statcastPrimaryAttribute ? `, ${relic.statcastPrimaryAttribute}` : " Battlecast"}`}
              aria-pressed={selected}
              style={{ "--class-color": color } as CSSProperties}
              onClick={() =>
                onChoose(
                  family.variants.find((variant) => variant.id === selectedId)
                    ?.id ?? relic.id,
                )
              }
            >
              <span className={styles.cardClass}>
                <Image
                  src={`/assets/icons/${family.className}.png`}
                  width={16}
                  height={16}
                  alt={family.className}
                  unoptimized
                />
                {owned > 0 && (
                  <span>
                    <Check size={11} />
                    {owned} owned
                  </span>
                )}
              </span>
              <span className={styles.portrait}>
                <Image
                  src={relic.portraitPath}
                  width={128}
                  height={128}
                  alt=""
                  sizes="(max-width: 600px) 120px, 140px"
                />
              </span>
              <strong>{family.title}</strong>
              <span className={styles.cardAttribute}>
                {relic.statcastPrimaryAttribute ? (
                  <>
                    <RelicAttributeGlyph
                      icon={attributeIcons[relic.statcastPrimaryAttribute]}
                    />
                    {relic.statcastPrimaryAttribute}
                  </>
                ) : (
                  <>
                    <Swords size={13} />
                    Battlecast
                  </>
                )}
              </span>
              <span className={styles.rarities}>
                {relic.stars.map((stars) => `${stars}★`).join("  ")}
              </span>
            </button>
          );
        })}
        {!visible.length && (
          <div className={styles.empty}>
            <Search size={30} />
            <strong>No matching relics</strong>
            <p>Try another name, attribute or class.</p>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  query: "",
                  type: "all",
                  className: "all",
                  attribute: "all",
                })
              }
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
