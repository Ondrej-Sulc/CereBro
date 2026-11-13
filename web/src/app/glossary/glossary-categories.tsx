import Link from 'next/link';
import { ArrowRight, Ban, Check, Crosshair, Droplets, EyeOff, Footprints, Heart, HeartOff, HeartPulse, LayoutGrid, ShieldCheck, ShieldOff, Sparkles, Zap, ZapOff } from 'lucide-react';
import type { GlossaryCatalog } from '@/lib/data/effect-glossary';
import { glossaryQuery, type GlossaryFilters } from '@/lib/effect-glossary';
import { GlossaryCategoryPicker } from './glossary-category-picker';
import styles from './glossary.module.css';

const categoryDisplay = {
  'damage over time': { label: 'Damage over time', icon: Droplets, order: 0 },
  'buff control': { label: 'Buff control', icon: Sparkles, order: 10 },
  'debuff control': { label: 'Debuff control', icon: ShieldCheck, order: 11 },
  'power control': { label: 'Power control', icon: Zap, order: 20 },
  'regeneration control': { label: 'Regeneration control', icon: HeartOff, order: 30 },
  'regeneration': { label: 'Regeneration', icon: HeartPulse, order: 31 },
  'ability accuracy reduction': { label: 'Ability accuracy reduction', icon: Crosshair, order: 40 },
  'auto-block counters': { label: 'Auto-block counters', icon: ShieldOff, order: 50 },
  'evasion counters': { label: 'Evasion counters', icon: Footprints, order: 51 },
  'miss counters': { label: 'Miss counters', icon: EyeOff, order: 52 },
  'unstoppable counters': { label: 'Unstoppable counters', icon: Ban, order: 53 },
  'death counters': { label: 'Death counters', icon: Heart, order: 54 },
};
const effectCount = (count: number) => `${count} ${count === 1 ? 'effect' : 'effects'}`;

function presentation(name: string) {
  const scope = name.match(/\s+\((Self|Opponent)\)$/i)?.[1];
  const base = name.replace(/\s+\((Self|Opponent|DoT)\)$/i, '');
  const known = categoryDisplay[base.toLowerCase() as keyof typeof categoryDisplay];
  return { label: known?.label ?? base, scope: scope ? scope[0].toUpperCase() + scope.slice(1).toLowerCase() : null,
    icon: base.toLowerCase() === 'power control' && scope?.toLowerCase() === 'opponent' ? ZapOff : known?.icon ?? LayoutGrid,
    order: (known?.order ?? 100) + (base.toLowerCase() === 'power control' && scope?.toLowerCase() === 'self' ? 1 : 0) };
}

export function GlossaryCategories({ categories, filters }: { categories: GlossaryCatalog['categories']; filters: GlossaryFilters }) {
  const selected = categories.find(category => category.id === filters.category);
  const items = categories.map(category => ({ ...category, display: presentation(category.name) }))
    .sort((a, b) => a.display.order - b.display.order || a.name.localeCompare(b.name));
  const current = selected ? presentation(selected.name) : null;
  const Icon = current?.icon ?? LayoutGrid;
  return <section id="effect-categories" className={styles.categoryBrowser} aria-labelledby="category-title">
    <GlossaryCategoryPicker selected={!!selected} label={selected ? `Change category: ${selected.name}, ${effectCount(selected._count.abilities)}` : `Browse by category, ${categories.length} categories`} summary={<>
      <Icon size={18} aria-hidden="true" className={styles.categorySymbol}/>
      <h2 id="category-title">{current?.label ?? 'Browse by category'}{current?.scope && <span className={styles.categoryScope}>{current.scope}</span>}</h2>
      <span className={styles.categorySummaryCount}>{selected ? effectCount(selected._count.abilities) : `${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`}</span>
    </>}>
      <nav className={styles.categoryGrid} aria-label="Effect categories">
        <Link prefetch={false} data-category-choice href={`${glossaryQuery('/glossary', filters, { category: null, page: 1 })}#effects-results`} aria-current={!filters.category ? 'page' : undefined}>
          <LayoutGrid size={16} aria-hidden="true" className={styles.categorySymbol}/><span className={styles.categoryLabel}><span className={styles.categoryName}>All effects</span></span><span className={styles.categoryCount}>{!filters.category ? <Check size={13} aria-hidden="true"/> : <ArrowRight size={13} aria-hidden="true"/>}</span>
        </Link>
        {items.map(category => <Link prefetch={false} data-category-choice key={category.id} aria-current={category.id === filters.category ? 'page' : undefined}
          aria-label={`${category.name}, ${effectCount(category._count.abilities)}`} href={`${glossaryQuery('/glossary', filters, { category: category.id, page: 1 })}#effects-results`}>
          <category.display.icon size={16} aria-hidden="true" className={styles.categorySymbol}/>
          <span className={styles.categoryLabel}><span className={styles.categoryName}>{category.display.label}</span>{category.display.scope && <span className={styles.categoryScope}>{category.display.scope}</span>}</span>
          <span className={styles.categoryCount}>{category._count.abilities}{category.id === filters.category && <Check size={12} aria-hidden="true"/>}</span>
        </Link>)}
      </nav>
    </GlossaryCategoryPicker>
  </section>;
}
