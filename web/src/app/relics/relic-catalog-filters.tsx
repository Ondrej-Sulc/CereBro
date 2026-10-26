"use client";

import { useId, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import {
  Check,
  Gem,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Swords,
  X,
} from "lucide-react";
import type { ChampionClass } from "@prisma/client";
import type { RelicFilters } from "@cerebro/core/domain/relic-catalog";
import type { RelicCatalogData } from "@/lib/data/relics";
import type { RelicAttributeIcon } from "@/lib/relic-attribute-icons";
import { getChampionClassColors } from "@/lib/championClassHelper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import styles from "./relic-catalog-filters.module.css";

export const DEFAULT_RELIC_FILTERS: RelicFilters = {
  query: "",
  type: "all",
  className: "all",
  attribute: "all",
};
const CLASSES = [
  "Cosmic",
  "Tech",
  "Mutant",
  "Skill",
  "Science",
  "Mystic",
] as const;
const TYPES = [
  { key: "all", label: "All relics", Icon: Gem },
  { key: "battlecast", label: "Battlecasts", Icon: Swords },
  { key: "statcast", label: "Statcasts", Icon: SlidersHorizontal },
] as const;

function classAccent(className: string): CSSProperties {
  return {
    "--filter-color": getChampionClassColors(
      className.toUpperCase() as ChampionClass,
    ).color,
  } as CSSProperties;
}

function AttributeFilterIcon({ icon }: { icon?: RelicAttributeIcon }) {
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
    <SlidersHorizontal
      size={18}
      className={styles.attributeFallback}
      aria-hidden="true"
    />
  );
}

export function RelicCatalogFilters({
  data,
  filters,
  onChange,
  visibleFamilies,
  visibleVariants,
}: {
  data: RelicCatalogData;
  filters: RelicFilters;
  onChange: (filters: RelicFilters) => void;
  visibleFamilies: number;
  visibleVariants: number;
}) {
  const id = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const attributes = [
    ...new Set(
      data.families.flatMap((family) =>
        family.variants.flatMap((relic) =>
          [
            relic.statcastPrimaryAttribute,
            relic.statcastSecondaryAttribute,
          ].filter((value): value is string => !!value),
        ),
      ),
    ),
  ].sort();
  const typeCounts = {
    all: data.families.length,
    battlecast: data.families.filter((family) => family.type === "battlecast")
      .length,
    statcast: data.families.filter((family) => family.type === "statcast")
      .length,
  };
  const chips: { key: keyof RelicFilters; label: string }[] = [];
  if (filters.type !== "all")
    chips.push({
      key: "type",
      label: filters.type === "battlecast" ? "Battlecasts" : "Statcasts",
    });
  if (filters.className !== "all")
    chips.push({ key: "className", label: filters.className });
  if (filters.attribute !== "all")
    chips.push({ key: "attribute", label: filters.attribute });
  if (filters.query.trim())
    chips.push({ key: "query", label: `“${filters.query.trim()}”` });
  const extraCount =
    Number(filters.className !== "all") + Number(filters.attribute !== "all");
  const attributeDisabled = filters.type === "battlecast";

  return (
    <div className={styles.filters}>
      <section className={styles.panel} aria-label="Relic filters">
        <div className={styles.primaryRow}>
          <div className={styles.typeTabs} role="group" aria-label="Relic type">
            {TYPES.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                aria-label={`${label} (${typeCounts[key]} families)`}
                aria-pressed={filters.type === key}
                onClick={() =>
                  onChange({
                    ...filters,
                    type: key,
                    attribute: key === "battlecast" ? "all" : filters.attribute,
                  })
                }
              >
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
                <span className={styles.typeCount}>{typeCounts[key]}</span>
              </button>
            ))}
          </div>
          <div className={styles.searchRow}>
            <div className={styles.search} data-active={!!filters.query}>
              <Search size={18} aria-hidden="true" />
              <label htmlFor={`${id}-search`} className="sr-only">
                Search relics
              </label>
              <input
                ref={searchRef}
                id={`${id}-search`}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search relics…"
                value={filters.query}
                onChange={(event) =>
                  onChange({ ...filters, query: event.target.value })
                }
              />
              {filters.query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    onChange({ ...filters, query: "" });
                    searchRef.current?.focus();
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              type="button"
              className={styles.mobileToggle}
              aria-label="Filters"
              aria-expanded={expanded}
              aria-controls={`${id}-extra`}
              onClick={() => setExpanded(!expanded)}
              data-active={extraCount > 0}
            >
              <SlidersHorizontal size={17} aria-hidden="true" />
              <span>Filters</span>
              {extraCount > 0 && (
                <span className={styles.extraCount}>{extraCount}</span>
              )}
            </button>
          </div>
        </div>
        <div
          id={`${id}-extra`}
          className={styles.secondaryRow}
          data-expanded={expanded}
        >
          <div
            className={styles.classField}
            role="group"
            aria-label="Champion class"
          >
            <div className={styles.fieldHeading}>
              <span>CHAMPION CLASS</span>
              <button
                type="button"
                className={styles.allClasses}
                aria-pressed={filters.className === "all"}
                onClick={() => onChange({ ...filters, className: "all" })}
              >
                {filters.className === "all" && (
                  <Check size={12} aria-hidden="true" />
                )}
                All classes
              </button>
            </div>
            <div className={styles.classOptions}>
              {CLASSES.map((className) => (
                <button
                  key={className}
                  type="button"
                  style={classAccent(className)}
                  aria-pressed={filters.className === className}
                  onClick={() =>
                    onChange({
                      ...filters,
                      className:
                        filters.className === className ? "all" : className,
                    })
                  }
                >
                  <Image
                    src={`/assets/icons/${className}.png`}
                    alt=""
                    width={20}
                    height={20}
                    unoptimized
                  />
                  <span>{className}</span>
                  <Check
                    className={styles.classCheck}
                    size={13}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>
          <div
            className={styles.attributeField}
            data-disabled={attributeDisabled}
          >
            <div className={styles.fieldHeading}>
              <label htmlFor={`${id}-attribute`}>STATCAST ATTRIBUTE</label>
            </div>
            <Select
              value={filters.attribute}
              disabled={attributeDisabled}
              onValueChange={(attribute) => onChange({ ...filters, attribute })}
            >
              <SelectTrigger
                id={`${id}-attribute`}
                className={styles.attributeTrigger}
                data-active={filters.attribute !== "all"}
                aria-label="Statcast attribute"
              >
                <span className={styles.attributeValue}>
                  <AttributeFilterIcon
                    icon={
                      attributeDisabled
                        ? undefined
                        : data.attributeIcons[filters.attribute]
                    }
                  />
                  {attributeDisabled ? (
                    <span>Statcasts only</span>
                  ) : (
                    <SelectValue placeholder="All attributes">
                      {filters.attribute === "all"
                        ? "All attributes"
                        : filters.attribute}
                    </SelectValue>
                  )}
                </span>
              </SelectTrigger>
              <SelectContent
                className={styles.attributeMenu}
                align="end"
                collisionPadding={16}
              >
                <SelectItem
                  className={styles.attributeOption}
                  value="all"
                  textValue="All attributes"
                >
                  <span className={styles.attributeOptionLabel}>
                    <AttributeFilterIcon />
                    <span>All attributes</span>
                  </span>
                </SelectItem>
                <SelectSeparator className={styles.menuSeparator} />
                {attributes.map((attribute) => (
                  <SelectItem
                    className={styles.attributeOption}
                    key={attribute}
                    value={attribute}
                    textValue={attribute}
                  >
                    <span className={styles.attributeOptionLabel}>
                      <AttributeFilterIcon
                        icon={data.attributeIcons[attribute]}
                      />
                      <span>{attribute}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
      <div className={styles.resultRow}>
        <p
          className={styles.resultCount}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <strong>{visibleFamilies}</strong> of {data.families.length} families
          <span aria-hidden="true">·</span>
          {visibleVariants} {visibleVariants === 1 ? "variant" : "variants"}
        </p>
        {chips.length > 0 && (
          <div
            className={styles.activeFilters}
            role="group"
            aria-label="Active filters"
          >
            {chips.map((chip) => (
              <button
                type="button"
                key={chip.key}
                className={styles.chip}
                style={
                  chip.key === "className"
                    ? classAccent(filters.className)
                    : undefined
                }
                data-class={chip.key === "className"}
                aria-label={`Remove ${chip.key === "query" ? "search" : chip.key === "className" ? "class" : chip.key} filter: ${chip.label}`}
                onClick={() =>
                  onChange({
                    ...filters,
                    [chip.key]: DEFAULT_RELIC_FILTERS[chip.key],
                  })
                }
              >
                {chip.key === "className" && (
                  <Image
                    src={`/assets/icons/${filters.className}.png`}
                    alt=""
                    width={14}
                    height={14}
                    unoptimized
                  />
                )}
                <span>{chip.label}</span>
                <X size={12} aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              className={styles.clearAll}
              onClick={() => onChange(DEFAULT_RELIC_FILTERS)}
            >
              <RotateCcw size={13} aria-hidden="true" />
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
