"use client";

import { useEffect, useRef } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import type { RelicScreenshotMatch } from '@cerebro/core/domain/relic-screenshot';
import type { RelicAttributeIcon } from '@/lib/relic-attribute-icons';
import { RelicAttributeGlyph } from './relic-picker';
import { groupRelicReviewVariants, sharedRelicReviewBuild } from './relic-screenshot-review';
import styles from './relic-screenshot-import.module.css';

export function RelicScreenshotChoices({ matches, choice, pendingVariantId, attributeIcons, disabled, showIdentity, onChoose, onVariantChange }: {
  matches: RelicScreenshotMatch[];
  choice: number | null;
  pendingVariantId: string | null;
  attributeIcons: Record<string, RelicAttributeIcon>;
  disabled: boolean;
  showIdentity: boolean;
  onChoose: (index: number) => void;
  onVariantChange: (relicId: string) => void;
}) {
  const variants = groupRelicReviewVariants(matches);
  const buildChoices = useRef<HTMLDivElement>(null);
  const chosen = choice === null ? null : matches[choice];
  const selectedId = pendingVariantId ?? chosen?.relicId ?? (variants.length === 1 ? variants[0].relicId : null);
  const selected = variants.find(variant => variant.relicId === selectedId);
  useEffect(() => {
    if (pendingVariantId) buildChoices.current?.focus({preventScroll:true});
  }, [pendingVariantId]);
  const shared = sharedRelicReviewBuild(matches);
  const groups = new Map<number, NonNullable<typeof selected>['choices']>();
  selected?.choices.forEach(option => groups.set(option.match.stars, [...(groups.get(option.match.stars) ?? []), option]));
  return <div className={styles.reviewChoices}>
    {variants.length > 1 && <fieldset disabled={disabled} className={styles.variantFieldset}>
      <legend>Choose the secondary attribute</legend>
      {shared && <p className={styles.sharedBuild}>{shared.stars}★ <span>Rank {shared.rank}</span><span>Sig {shared.sigLevel}</span><small>Same build for every option</small></p>}
      <div className={styles.variantChoices}>
        {variants.map(variant => <button key={variant.relicId} type="button" aria-pressed={selectedId === variant.relicId}
          onClick={() => {
            if (variant.choices.length === 1) onChoose(variant.choices[0].index);
            else onVariantChange(variant.relicId);
          }}>
          <span className={styles.variantIcon}><RelicAttributeGlyph icon={attributeIcons[variant.attribute ?? '']} /></span>
          <span className={styles.variantLabel}><strong>{variant.attribute ?? variant.name}</strong>
            {showIdentity && variant.attribute && <small>{variant.name}</small>}
            {!shared && <small>{variant.choices.length === 1
              ? `${variant.choices[0].match.stars}★ · Rank ${variant.choices[0].match.rank} · Sig ${variant.choices[0].match.sigLevel}`
              : `${variant.choices.length} possible builds`}</small>}
          </span>
          {selectedId === variant.relicId ? <Check size={16} /> : <ChevronRight size={15} />}
        </button>)}
      </div>
    </fieldset>}
    {selected && (variants.length === 1 || selected.choices.length > 1) && <div ref={buildChoices} tabIndex={-1} className={styles.buildChoices}>
      {variants.length > 1 && <p className={styles.buildPrompt}>Now choose the rank for {selected.attribute ?? selected.name}.</p>}
      <div className={styles.choiceGroups}>{[...groups].map(([stars, options]) => <fieldset key={stars} className={styles.choiceGroup} disabled={disabled}>
        <legend>{stars}★{selected.attribute && <><RelicAttributeGlyph icon={attributeIcons[selected.attribute]} />{selected.attribute}</>}</legend>
        <div className={styles.choices}>{options.map(({index, match}) => <button type="button" key={index}
          aria-label={`${stars}★ · ${selected.attribute ?? selected.name}, Rank ${match.rank}, Sig ${match.sigLevel}`}
          aria-pressed={choice === index} onClick={() => onChoose(index)}>
          <strong>Rank {match.rank}</strong><span>Sig {match.sigLevel}</span>{choice === index && <Check size={14} />}
        </button>)}</div>
      </fieldset>)}</div>
    </div>}
  </div>;
}
