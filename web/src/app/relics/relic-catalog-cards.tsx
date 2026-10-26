import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, SlidersHorizontal, Swords } from "lucide-react";
import type { ChampionClass } from "@prisma/client";
import type { RelicCatalogData } from "@/lib/data/relics";
import { getChampionClassColors } from "@/lib/championClassHelper";
import styles from "./relic-catalog-cards.module.css";

type RelicFamily = RelicCatalogData["families"][number];

function RelicCatalogCard({
  family,
  attributeIcons,
}: {
  family: RelicFamily;
  attributeIcons: RelicCatalogData["attributeIcons"];
}) {
  const relic = family.variants[0];
  const isBattlecast = family.type === "battlecast";
  const attributeIcon =
    !isBattlecast && relic.statcastPrimaryAttribute
      ? attributeIcons[relic.statcastPrimaryAttribute]
      : undefined;
  const TypeIcon = isBattlecast ? Swords : SlidersHorizontal;
  const color = getChampionClassColors(
    family.className.toUpperCase() as ChampionClass,
  ).color;
  const secondary =
    family.variants.length === 1
      ? relic.statcastSecondaryAttribute
      : `${family.variants.length} secondary variants`;

  return (
    <Link
      href={`/relics/${relic.slug}`}
      className={styles.card}
      style={{ "--class-color": color } as CSSProperties}
      data-relic-type={family.type}
    >
      <div className={styles.stage}>
        <div className={styles.top}>
          <span className={styles.classLabel}>
            <Image
              src={`/assets/icons/${family.className}.png`}
              alt=""
              width={17}
              height={17}
              unoptimized
            />
            {family.className}
          </span>
          <span className={styles.typeLabel} data-type={family.type}>
            <TypeIcon size={13} />
            {isBattlecast ? "Battlecast" : "Statcast"}
          </span>
        </div>
        <span className={styles.orbit} aria-hidden="true" />
        <Image
          className={styles.portrait}
          src={relic.portraitPath}
          alt=""
          width={216}
          height={216}
          sizes="(max-width: 340px) 200px, (max-width: 700px) 175px, 216px"
        />
        <div className={styles.title}>
          <h2>{family.title}</h2>
          <span
            className={styles.rarities}
            role="img"
            aria-label={`Available rarities: ${relic.stars.join(", ")} stars`}
          >
            {relic.stars.map((star) => (
              <span key={star}>
                {star}
                <span aria-hidden="true">★</span>
              </span>
            ))}
          </span>
        </div>
      </div>
      <div className={styles.shelf}>
        <div>
          <small>{isBattlecast ? "BATTLECAST KIT" : "PRIMARY ATTRIBUTE"}</small>
          <strong className={styles.primaryValue}>
            {attributeIcon && (
              <span
                className={styles.attributeIcon}
                aria-hidden="true"
                style={
                  { "--attribute-color": attributeIcon.color } as CSSProperties
                }
              >
                <span
                  style={{
                    mask: `url(${attributeIcon.iconUrl}) center / contain no-repeat`,
                    WebkitMask: `url(${attributeIcon.iconUrl}) center / contain no-repeat`,
                  }}
                />
              </span>
            )}
            <span>
              {isBattlecast
                ? "Striker & innate ability"
                : relic.statcastPrimaryAttribute}
            </span>
          </strong>
          <span>{isBattlecast ? "Explore rune options" : secondary}</span>
        </div>
        <span className={styles.circleArrow} aria-hidden="true">
          <ArrowUpRight size={19} />
        </span>
      </div>
    </Link>
  );
}

export function RelicCatalogCards({
  families,
  attributeIcons,
}: {
  families: RelicFamily[];
  attributeIcons: RelicCatalogData["attributeIcons"];
}) {
  return (
    <div className={styles.grid}>
      {families.map((family) => (
        <RelicCatalogCard
          key={family.id}
          family={family}
          attributeIcons={attributeIcons}
        />
      ))}
    </div>
  );
}
