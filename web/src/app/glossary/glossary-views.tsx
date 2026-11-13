import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Info, Search, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { ChampionClass } from '@prisma/client';
import { EFFECT_DIRECTION_LABELS, EFFECT_FORM_LABELS, readAbilitySource } from '@cerebro/core/domain/ability-source';
import { resistanceLabel } from '@cerebro/core/domain/champion-resistance';
import { formatGameText } from '@cerebro/core/domain/champion-ability-text/renderer';
import { GLOSSARY_GROUPS, glossaryHref, glossaryQuery, isSynergyApplication, type GlossaryFilters } from '@/lib/effect-glossary';
import type { GlossaryCatalog, GlossaryDetail, GlossaryEffect } from '@/lib/data/effect-glossary';
import { getChampionImageUrlOrPlaceholder } from '@/lib/championHelper';
import { getChampionClassColors } from '@/lib/championClassHelper';
import { EffectSources, EffectSourceCondition, SynergySourceBadge } from '@/components/champions/effect-sources';
import { GlossarySearchForm } from './glossary-search-form';
import { GlossaryCategories } from './glossary-categories';
import styles from './glossary.module.css';

function effectPalette(effect: GlossaryEffect): CSSProperties {
  return { '--effect-color': effect.color, '--effect-secondary': effect.secondaryColor } as CSSProperties;
}
export function GlossaryShell({ children, effect }: { children: ReactNode; effect?: GlossaryEffect }) {
  return <div className={`${styles.shell}${effect ? ` ${styles.effectPage}` : ""}`} style={effect ? effectPalette(effect) : undefined}>{children}</div>;
}
export function EffectIcon({ effect, large = false }: { effect: GlossaryEffect; large?: boolean }) {
  return <span aria-hidden="true" className={`${styles.icon} ${large ? styles.largeIcon : ''}`} style={effectPalette(effect)}>
    {effect.iconUrl ? <Image unoptimized src={effect.iconUrl} alt="" width={large ? 54 : 27} height={large ? 54 : 27} className={styles.iconArtwork} /> : <Sparkles />}
  </span>;
}
function Provenance() {
  return <details className={styles.provenance}><summary><BookOpen size={14} aria-hidden="true" />About this catalog <ChevronDown size={14} aria-hidden="true" /></summary><p>Definitions and categories use CereBro’s recorded effect catalog and bound game glossary. Category totals cover the full catalog, and effects may belong to more than one category. Champion sources keep their own form, direction, conditions and required partners. Reviewed copy and resistance classifications are shown only while their source and evidence bindings are current. Star filters use public obtainable rarities; a synergy’s recorded owner-star requirements also apply. This is a public champion catalog, not a team activation check.</p></details>;
}
export function GlossaryCatalogView({ data }: { data: GlossaryCatalog }) {
  const { filters, results, categories } = data;
  const selectedCategory = categories.find(category => category.id === filters.category);
  return <GlossaryShell>
    <header className={styles.hero}><h1>Effect glossary</h1><p className={styles.intro}>Find effects, champions and counters.</p></header>
    <GlossaryCategories categories={categories} filters={filters}/>
    <section id="effects-results" className={styles.browseResults} data-category-selected={!!selectedCategory} aria-labelledby="effects-title" tabIndex={-1}>
      <div className={styles.resultsHeading}><div><h2 id="effects-title">{selectedCategory ? 'Effects' : filters.category ? 'Unknown category' : 'All effects'}</h2>{(!selectedCategory || filters.q) && <p>{results.total} {results.total === 1 ? 'effect' : 'effects'}{filters.q ? ` matching “${filters.q}”` : ''}</p>}</div></div>
      {selectedCategory?.description && <p className={styles.categoryDescription}>{selectedCategory.description}</p>}
      <GlossarySearchForm key={glossaryQuery('/glossary', filters)} className={styles.searchForm}>
        {filters.category && <input type="hidden" name="category" value={filters.category} />}
        <label className={styles.searchLabel}><span className={styles.srOnly}>Search effects</span><div><Search size={17} aria-hidden="true" /><input name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder={filters.category ? 'Search within this category…' : 'Search all effects…'} /></div></label>
        <button className={styles.catalogSearchButton} type="submit" aria-label="Search effects"><ArrowRight size={18} aria-hidden="true" /></button>
        {filters.q && <Link href={`${glossaryQuery('/glossary', filters, { q: '', page: 1 })}#effects-results`} className={styles.clearSearch}>Clear search</Link>}
      </GlossarySearchForm>
      {results.rows.length ? <div className={styles.effectGrid}>{results.rows.map(effect => <Link prefetch={false} key={effect.id} href={glossaryHref(effect.id, glossaryQuery('/glossary', filters, { page: results.page }))} className={styles.effectCard} style={effectPalette(effect)}><div className={styles.cardTop}><EffectIcon effect={effect} /><ArrowRight size={17} aria-hidden="true" className={styles.cardArrow} /></div><h3>{effect.name}</h3><p className={!effect.description ? styles.missingDefinition : undefined}>{effect.description || 'Definition not recorded'}</p><div className={styles.cardCategories}>{effect.categories.filter(category => category.id !== filters.category).slice(0, 2).map(category => <span key={category.id}>{category.name}</span>)}</div></Link>)}</div> : <EmptyState title="No effects found" description="Try a shorter search or explore all categories." href="/glossary" label="Browse all effects" />}
      <Pagination path="/glossary" filters={filters} results={results} noun="effects" />
    </section><Provenance />
  </GlossaryShell>;
}

export function GlossaryDetailView({ data }: { data: GlossaryDetail }) {
  const { effect, filters, counts, results } = data;
  const path = glossaryHref(effect.id);
  return <GlossaryShell effect={effect}>
    <Link className={styles.backLink} href={filters.returnTo || '/glossary'}><ArrowLeft size={16} aria-hidden="true" />Effect glossary</Link>
    <header className={styles.detailHero}><EffectIcon effect={effect} large /><div><h1>{effect.name}</h1><div className={styles.detailCategories}>{effect.categories.map(category => <Link key={category.id} href={`/glossary?category=${category.id}`}>{category.name}</Link>)}</div></div></header>
    <p className={styles.definition}>{effect.description || 'No definition is recorded for this effect yet.'}</p>
    <nav className={styles.groupTabs} aria-label="Champion effect groups">{GLOSSARY_GROUPS.map(item => <Link prefetch={false} key={item.id} href={glossaryQuery(path, filters, { group: item.id, page: 1 })} aria-current={filters.group === item.id ? 'page' : undefined}>{item.id === 'ABILITY' ? <Sparkles size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}<span>{item.label}</span><strong>{counts[item.id]}</strong></Link>)}</nav>
    <ChampionFilters path={path} filters={filters} />
    <div className={styles.resultToolbar}><h2>{results.total} {results.total === 1 ? 'champion' : 'champions'}</h2><details className={styles.groupInfo}><summary><Info size={14} aria-hidden="true" />{filters.group === 'ABILITY' ? 'About sources' : filters.group === 'IMMUNITY' ? 'About immunity' : 'About resistance'}</summary><p>{filters.group === 'ABILITY' ? 'Form and direction match the same source application.' : filters.group === 'IMMUNITY' ? 'Immunity can be conditional or require a synergy. Read each source.' : 'Resistance reduces a recorded mechanism. Even 100% does not establish immunity.'}</p></details></div>
    {results.rows.length ? <div className={styles.championGrid}>{results.rows.map(champion => <article key={champion.id} className={styles.championCard}><div className={styles.championIdentity}><Image src={getChampionImageUrlOrPlaceholder(champion.images, '64')} alt="" width={48} height={48} className={styles.portrait} style={{ '--champion-color': getChampionClassColors(champion.class as ChampionClass)?.color ?? '#94a3b8' } as CSSProperties} /><div>{champion.slug ? <Link prefetch={false} href={`/champions/${champion.slug}${filters.stars ? `?rarity=${filters.stars}` : ''}`} className={styles.championName}>{champion.name}<ArrowRight size={13} aria-hidden="true" /></Link> : <h3 className={styles.championName}>{champion.name}</h3>}<p>{champion.class[0] + champion.class.slice(1).toLowerCase()}</p></div><span className={styles.applicationCount}>{champion.applications.length} {champion.applications.length === 1 ? 'source' : 'sources'}</span></div>
      <ChampionSources champion={champion} stars={filters.stars}/>
    </article>)}</div> : <EmptyState title={`No matching ${filters.group === 'ABILITY' ? 'champions' : filters.group === 'IMMUNITY' ? 'immunities' : 'resistances'}`} description="No current recorded sources match this scope. Try clearing the filters or choosing another group." href={`${path}?group=${filters.group}`} label="Clear champion filters" />}
    <Pagination path={path} filters={filters} results={results} noun="champions" /><Provenance />
  </GlossaryShell>;
}

function ChampionFilters({ path, filters }: { path: string; filters: GlossaryFilters }) {
  const ability = filters.group === 'ABILITY';
  const advanced = [filters.championClass && filters.championClass[0] + filters.championClass.slice(1).toLowerCase(),
    filters.stars && `${filters.stars}★`, filters.form && `${ability ? '' : 'Effect: '}${EFFECT_FORM_LABELS[filters.form as keyof typeof EFFECT_FORM_LABELS]}`,
    filters.direction && `${ability ? '' : 'Effect: '}${EFFECT_DIRECTION_LABELS[filters.direction as keyof typeof EFFECT_DIRECTION_LABELS]}`].filter(Boolean);
  const active = [filters.q && `“${filters.q}”`, ...advanced].filter(Boolean);
  const reset = glossaryQuery(path, { ...filters, q: '', category: null, stars: '', championClass: '', form: '', direction: '', page: 1 });
  return <form key={glossaryQuery(path, filters)} action={path} method="get" className={styles.detailControls} role="search" aria-label="Find champions">
    <input type="hidden" name="group" value={filters.group} />
    {filters.returnTo && <input type="hidden" name="returnTo" value={filters.returnTo} />}
    {!ability && <><input type="hidden" name="form" value={filters.form} /><input type="hidden" name="direction" value={filters.direction} /></>}
    <div className={styles.championSearchRow}>
      <label className={styles.championSearch}><span className={styles.srOnly}>Search champions</span><input type="search" name="q" defaultValue={filters.q} placeholder="Search champions…" maxLength={100} /></label>
      <button type="submit" className={styles.searchButton} aria-label="Search champions"><Search size={17} aria-hidden="true" /></button>
    </div>
    <details className={styles.advancedFilters}>
      <summary><SlidersHorizontal size={15} aria-hidden="true" />Filters{advanced.length > 0 && <span>{advanced.length}</span>}<ChevronDown size={13} aria-hidden="true" /></summary>
      <div className={styles.advancedPanel}>
        <label><span>Class</span><select name="class" defaultValue={filters.championClass}><option value="">All classes</option>{['COSMIC', 'TECH', 'MUTANT', 'SKILL', 'SCIENCE', 'MYSTIC', 'SUPERIOR'].map(value => <option key={value} value={value}>{value[0] + value.slice(1).toLowerCase()}</option>)}</select></label>
        <label><span>Obtainable stars</span><select name="stars" defaultValue={filters.stars}><option value="">All stars</option>{[7, 6, 5, 4, 3, 2, 1].map(stars => <option value={stars} key={stars}>{stars}★</option>)}</select></label>
        {ability && <><label><span>Source form</span><select name="form" defaultValue={filters.form}><option value="">All forms</option>{Object.entries(EFFECT_FORM_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label><span>Direction</span><select name="direction" defaultValue={filters.direction}><option value="">All directions</option>{Object.entries(EFFECT_DIRECTION_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></>}
        <div className={styles.filterActions}><button type="submit" className={styles.applyButton}>Apply filters<ArrowRight size={15} aria-hidden="true" /></button><Link href={reset}>Reset filters</Link></div>
      </div>
    </details>
    {active.length > 0 && <div className={styles.activeScope} aria-label="Active champion filters">{active.map(label => <span key={String(label)}>{label}</span>)}<Link href={reset}>Reset</Link></div>}
  </form>;
}

function ChampionSources({ champion, stars }: { champion: GlossaryDetail['results']['rows'][number]; stars: string }) {
  const applications = champion.synergySources ? champion.applications.filter(application => !isSynergyApplication(application)) : champion.applications;
  const query = new URLSearchParams({ tab: 'synergies' });
  if (stars) query.set('rarity', stars);
  return <>
    {applications[0] && <Application application={applications[0]}/>}
    {applications.length > 1 && <details className={styles.moreSources}><summary><ChevronDown size={14} aria-hidden="true"/>{applications.length - 1} more {applications.length === 2 ? 'source' : 'sources'}</summary><div>{applications.slice(1).map(application => <Application key={`${application.id}:${application.type}`} application={application}/>)}</div></details>}
    {champion.synergySources && <div className={styles.kitSynergySources} data-synergy-sources data-source-ids={champion.applications.filter(isSynergyApplication).map(application => application.id).join(',')}><EffectSources effect={champion.synergySources.effect} groups={champion.synergySources.groups} synergiesHref={champion.slug ? `/champions/${champion.slug}?${query}` : undefined}/></div>}
  </>;
}

type ApplicationData = GlossaryDetail['results']['rows'][number]['applications'][number];
function Application({ application }: { application: ApplicationData }) {
  const source = readAbilitySource(application);
  const synergy = isSynergyApplication(application);
  // Canonical Kit parsing separates a complete header; legacy requirements remain in the original text.
  const text = application.requirements ? application.requirements.condition : synergy ? source.condition : application.overviewSummary || source.condition;
  const readable = text && !/[{}]|\b(?:unresolved|legacy|audit)\b/i.test(text);
  const condition = formatGameText(readable ? text : 'Read the full source for its conditions.');
  const reference = application.sourceHref ? { label: application.sourceLabel, ariaLabel: `Read ${application.ability.name}: ${application.sourceLabel}`, href: application.sourceHref } : undefined;
  return <div className={styles.application} data-source-id={application.id}>
    {synergy && <div className="mb-2"><SynergySourceBadge champions={application.synergyChampions.map(partner => ({ name: partner.champion.name, slug: partner.champion.slug ?? null, images: partner.champion.images, class: partner.champion.class }))}/></div>}
    {application.resistance && <div className={styles.sourceBadges}><span className={styles.resistanceBadge}>{resistanceLabel(application.resistance)}</span></div>}
    <EffectSourceCondition condition={condition} form={source.effectForm} reference={reference}/>
    {application.requirements && <div className={styles.requirements}><p>Requires this champion at <strong>{application.requirements.ownerStars.map(star => `${star}★`).join('/')}</strong> with:</p><div className={styles.partnerAlternatives}>{application.requirements.partners.split(/(\s+(?:OR|AND)\s+)/i).map((part, index) => <span key={index} className={/^\s+(?:OR|AND)\s+$/i.test(part) ? styles.partnerConnector : undefined}><PartnerRequirement text={part} partners={application.synergyChampions} /></span>)}</div>{application.requirements.nonStacking && !/do(?:es)? not stack/i.test(condition) && <p>Does not stack.</p>}</div>}
  </div>;
}
function PartnerRequirement({ text, partners }: { text: string; partners: ApplicationData['synergyChampions'] }) {
  const names = partners.map(partner => partner.champion.name).sort((a, b) => b.length - a.length);
  if (!names.length) return <>{text}</>;
  const pattern = new RegExp(`(${names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{text.split(pattern).map((part, index) => {
    const partner = partners.find(partner => partner.champion.name.toLowerCase() === part.toLowerCase());
    return partner?.champion.slug ? <Link key={index} prefetch={false} href={`/champions/${partner.champion.slug}`}>{part}</Link> : part;
  })}</>;
}
export function EmptyState({ title, description, href, label }: { title: string; description: string; href: string; label: string }) {
  return <div className={styles.empty}><Search size={25} aria-hidden="true" /><h2>{title}</h2><p>{description}</p><Link href={href}>{label}<ArrowRight size={15} aria-hidden="true" /></Link></div>;
}
function Pagination({ path, filters, results, noun }: { path: string; filters: GlossaryFilters; results: { page: number; pages: number; total: number; size: number }; noun: string }) {
  if (!results.total) return null;
  return <nav className={styles.pagination} aria-label={`${noun} pages`}><p>{(results.page - 1) * results.size + 1}–{Math.min(results.page * results.size, results.total)} of {results.total} {noun}</p><div>{results.page > 1 && <Link rel="prev" href={glossaryQuery(path, filters, { page: results.page - 1 })}><ArrowLeft size={15} aria-hidden="true" />Previous</Link>}<span>Page {results.page} of {results.pages}</span>{results.page < results.pages && <Link rel="next" href={glossaryQuery(path, filters, { page: results.page + 1 })}>Next<ArrowRight size={15} aria-hidden="true" /></Link>}</div></nav>;
}
