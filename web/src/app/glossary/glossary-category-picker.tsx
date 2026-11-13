"use client";

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './glossary.module.css';

export function GlossaryCategoryPicker({ selected, summary, children, label }: {
  selected: boolean; summary: ReactNode; children: ReactNode; label?: string;
}) {
  // Preserve the closed picker across query changes, including choosing All effects.
  const [open, setOpen] = useState(!selected);
  return <details data-category-picker data-selected={selected} className={styles.categoryPicker} open={open}
    onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className={styles.categorySummary} aria-label={label}>{summary}<ChevronDown size={16} aria-hidden="true" className={styles.categoryChevron}/></summary>
    <div className={styles.categoryOptions} onClickCapture={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest('a[data-category-choice]')) setOpen(false);
    }}>{children}</div>
  </details>;
}
