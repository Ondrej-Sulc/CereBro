"use client";

import { useTransition, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Gem,
  Info,
  SlidersHorizontal,
  Sparkles,
  Star,
  Swords,
  Users,
} from "lucide-react";
import {
  selectableRelicRarities,
  resolveRelicDescription,
  type RelicSocketItem,
} from "@cerebro/core/domain/relic-catalog";
import { parseSynergyDescription } from "@cerebro/core/domain/champion-synergies";
import { relicRuneSections } from "@/lib/relic-rune-sections";
import type { RelicDetailData } from "@/lib/data/relics";
import type { RelicAttributeIcon } from "@/lib/relic-attribute-icons";
import { getChampionClassColors } from "@/lib/championClassHelper";
import type { ChampionClass } from "@prisma/client";
import styles from "./relic-details.module.css";

function AttributeGlyph({ icon }: { icon?: RelicAttributeIcon }) {
  if (!icon) return null;
  return (
    <span
      className={styles.attributeGlyph}
      aria-hidden="true"
      style={{ "--attribute-color": icon.color } as CSSProperties}
    >
      <span
        style={{
          mask: `url(${icon.iconUrl}) center / contain no-repeat`,
          WebkitMask: `url(${icon.iconUrl}) center / contain no-repeat`,
        }}
      />
    </span>
  );
}

export function RelicDetails({ data }: { data: RelicDetailData }) {
  const { relic, items, attributeIcons, runeIcons } = data;
  const isStatcast = relic.type === "statcast";
  const TypeIcon = isStatcast ? SlidersHorizontal : Swords;
  const router = useRouter();
  const query = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const rarities = selectableRelicRarities(relic);
  const requested = Number(query.get("rarity"));
  const rarity = rarities.find((r) => r.stars === requested) ?? rarities.at(-1);
  const runes = relicRuneSections(relic, items);
  const color = getChampionClassColors(
    relic.className.toUpperCase() as ChampionClass,
  ).color;
  const changeRarity = (stars: number) => {
    const params = new URLSearchParams(query.toString());
    params.set("rarity", String(stars));
    startTransition(() => router.replace(`?${params}`, { scroll: false }));
  };
  const describe = (item: RelicSocketItem) => {
    const context = rarity ? data.contexts[rarity.id]?.[item.id] : undefined;
    // Resolve the complete template so reduction wording and existing units
    // remain visible to the formatter across game color/glossary tags.
    const resolved = resolveRelicDescription(
      item.descriptionTemplate || item.unequippedDescriptionTemplate,
      context,
    );
    return (
      <div className={styles.description}>
        {parseSynergyDescription(
          resolved.map((part) => part.text).join(""),
        ).map((segment, i) => (
          <span
            key={i}
            style={{
              color: segment.color,
              fontWeight: segment.bold ? 600 : undefined,
              fontStyle: segment.italic ? "italic" : undefined,
            }}
          >
            {segment.text.split(/(Build-dependent)/).map((text, j) =>
              text === "Build-dependent" ? (
                <span
                  key={j}
                  className={styles.scaledValue}
                  title="This value depends on relic progression and/or the bound champion"
                >
                  {text}
                </span>
              ) : (
                <span key={j}>{text}</span>
              ),
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div
      className={styles.page}
      style={{ "--relic-color": color } as CSSProperties}
    >
      <Link href="/relics" className={styles.back}>
        <ArrowLeft size={15} /> Relic catalog
      </Link>

      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.portraitStage}>
            <span className={styles.orbit} aria-hidden="true" />
            <Image
              src={data.portraitPath}
              alt=""
              width={280}
              height={280}
              className={styles.portrait}
              sizes="(max-width: 600px) 190px, (max-width: 850px) 210px, (max-width: 1150px) 240px, 280px"
              priority
            />
          </div>
          <div className={styles.heroCopy}>
            <div className={styles.badges}>
              <span className={styles.classLabel}>
                <Image
                  src={`/assets/icons/${relic.className}.png`}
                  alt=""
                  width={19}
                  height={19}
                  unoptimized
                />
                {relic.className}
              </span>
              <span className={styles.typeBadge}>
                <TypeIcon size={14} />
                {isStatcast ? "Statcast" : "Battlecast"}
              </span>
            </div>
            <h1>{relic.name}</h1>
            <p className={styles.heroDescription}>
              {isStatcast
                ? "Explore its attribute bonuses and find your secondary variant."
                : "Explore the striker, innate ability and runes behind your pairing."}
            </p>
            {isStatcast ? (
              <div className={styles.heroAttributes}>
                {[
                  {
                    label: "Primary attribute",
                    name: relic.statcastPrimaryAttribute,
                  },
                  {
                    label: "Secondary attribute",
                    name: relic.statcastSecondaryAttribute,
                  },
                ].map(
                  ({ label, name }) =>
                    name && (
                      <div key={label}>
                        <AttributeGlyph icon={attributeIcons[name]} />
                        <div>
                          <small>{label}</small>
                          <strong>{name}</strong>
                        </div>
                      </div>
                    ),
                )}
              </div>
            ) : (
              <div className={styles.heroFacts}>
                <span>
                  <Sparkles size={15} />
                  {relic.innateSocketItemIds.length} core abilities
                </span>
                <span>
                  <Gem size={15} />
                  {runes.abilities.length + runes.attributes.length} rune
                  effects
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.rarityBar} aria-busy={isPending}>
          <div className={styles.rarityControl}>
            <span className={styles.eyebrow} id="rarity-label">
              Relic rarity
            </span>
            <div
              className={styles.rarityChoices}
              role="group"
              aria-labelledby="rarity-label"
            >
              {rarities.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  aria-label={`${r.stars} stars`}
                  aria-pressed={rarity?.stars === r.stars}
                  onClick={() => changeRarity(r.stars)}
                >
                  {r.stars}
                  <Star size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          {rarity && (
            <dl className={styles.progressionFacts} aria-live="polite">
              <div>
                <dt>Max rank</dt>
                <dd>{rarity.maxRank}</dd>
              </div>
              <div>
                <dt>Max signature</dt>
                <dd>{rarity.maxSignature}</dd>
              </div>
            </dl>
          )}
        </div>
      </header>

      {data.variants.length > 1 && (
        <section
          className={styles.variantPanel}
          aria-labelledby="variant-title"
        >
          <div className={styles.variantHeading}>
            <SlidersHorizontal size={19} aria-hidden="true" />
            <div>
              <h2 id="variant-title">Secondary variant</h2>
              <p>Choose a relic with a different secondary attribute.</p>
            </div>
          </div>
          <div className={styles.variantChoices}>
            {data.variants.map((variant) => (
              <Link
                aria-current={variant.id === relic.id ? "page" : undefined}
                key={variant.id}
                scroll={false}
                href={`/relics/${variant.slug}${rarity ? `?rarity=${rarity.stars}` : ""}`}
              >
                <AttributeGlyph
                  icon={attributeIcons[variant.secondaryAttribute ?? ""]}
                />
                <span>{variant.secondaryAttribute}</span>
                {variant.id === relic.id && (
                  <Check size={14} aria-hidden="true" />
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <details className={styles.valuesHelp}>
        <summary>
          <Info size={15} />
          <span>
            <strong>{rarity?.stars}★ progression ranges</strong>
            {" · lowest to highest"}
          </span>
          <ChevronDown size={14} />
        </summary>
        <p>
          Ranges cover the full rank, rune-level and signature progression for
          the selected rarity, rather than one build. Fixed values appear once.
          Resistance and other rating effects use unbound percentages; their
          final rating amounts depend on the champion. Attack- and Health-based
          effects show percentages of the bound champion’s respective stat,
          instead of flat amounts. Values without a supported conversion remain
          marked Build-dependent.
        </p>
      </details>

      <div className={styles.contentGrid}>
        <section
          className={styles.kitPanel}
          aria-labelledby="core-abilities-title"
        >
          <div className={styles.panelHeading}>
            <h2 id="core-abilities-title">
              {isStatcast ? "Relic abilities" : "Striker & innate"}
            </h2>
            <Sparkles size={21} aria-hidden="true" />
          </div>
          <div className={styles.entryList}>
            {relic.innateSocketItemIds.map((id) => {
              const item = items[id];
              const isStriker = item.type === "striker";
              const Icon = isStriker ? TypeIcon : Sparkles;
              return (
                <article
                  key={id}
                  className={styles.kitEntry}
                  data-relic-item={id}
                >
                  <span className={styles.entryGlyph} aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <div className={styles.entryContent}>
                    <span className={styles.eyebrow}>
                      {isStriker
                        ? isStatcast
                          ? "Relic attribute"
                          : "Striker"
                        : "Innate ability"}
                    </span>
                    <h3>{item.name}</h3>
                    {describe(item)}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className={styles.runeSections}>
          {[
            {
              id: "rune-abilities",
              title: "Abilities",
              entries: runes.abilities,
              Icon: Gem,
            },
            {
              id: "rune-attributes",
              title: "Attributes",
              entries: runes.attributes,
              Icon: SlidersHorizontal,
            },
          ]
            .filter((section) => section.entries.length > 0)
            .map(({ id, title, entries, Icon }) => (
              <section
                key={id}
                className={styles.kitPanel}
                aria-labelledby={id}
              >
                <div className={styles.panelHeading}>
                  <h2 id={id}>{title}</h2>
                  <Icon size={21} aria-hidden="true" />
                </div>
                <div className={styles.entryList}>
                  {entries.map((item) => (
                    <article
                      key={item.id}
                      className={styles.kitEntry}
                      data-relic-item={item.id}
                    >
                      {runeIcons[item.id] ? (
                        <AttributeGlyph icon={runeIcons[item.id]} />
                      ) : (
                        <span className={styles.entryGlyph} aria-hidden="true">
                          <Icon size={20} />
                        </span>
                      )}
                      <div className={styles.entryContent}>
                        <h3>{item.name}</h3>
                        {describe(item)}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          <p className={styles.runeNote}>
            <Info size={14} aria-hidden="true" />
            Available rune options. Unlocks and levels depend on relic rarity
            and progression.
          </p>
        </div>
      </div>

      <aside className={styles.sidePanel}>
        <section className={styles.pairings}>
          <div className={styles.asideHeading}>
            <Users size={18} />
            <h2>Suggested pairings</h2>
          </div>
          <p>Recommended by the game.</p>
          <div className={styles.recommendations}>
            {data.recommendations.map((c) => {
              const content = (
                <>
                  <span className={styles.championPortrait}>
                    {c.portraitUrl ? (
                      <Image
                        src={c.portraitUrl}
                        alt=""
                        width={42}
                        height={42}
                      />
                    ) : (
                      <Users size={20} />
                    )}
                  </span>
                  <span>
                    <strong>{c.name}</strong>
                    {c.className && <small>{c.className.toLowerCase()}</small>}
                  </span>
                  {c.slug && <ArrowUpRight size={15} aria-hidden="true" />}
                </>
              );
              const style = {
                "--champion-color": c.className
                  ? getChampionClassColors(c.className).color
                  : "#b5c5da",
              } as CSSProperties;
              return c.slug ? (
                <Link
                  key={c.gameId}
                  href={`/champions/${c.slug}`}
                  style={style}
                >
                  {content}
                </Link>
              ) : (
                <div key={c.gameId} style={style}>
                  {content}
                </div>
              );
            })}
          </div>
          {!data.recommendations.length && (
            <p>No pairing suggestions are recorded.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
