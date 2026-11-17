import styles from './quest-map-boss-treatment.module.css';

/** Decorations only: callers must gate this treatment on a recorded boss flag. */
export function QuestMapBossCorona({ x, y, radius, selected }: { x: number; y: number; radius: number; selected: boolean }) {
  const points = Array.from({ length: 24 }, (_, index) => {
    const angle = index * Math.PI / 12 - Math.PI / 2;
    const length = radius + (index % 3 === 0 ? 12 : 5);
    return `${x + Math.cos(angle) * length},${y + Math.sin(angle) * length}`;
  }).join(' ');
  return <g data-map-boss-treatment data-selected={selected} className={styles.corona} aria-hidden="true" pointerEvents="none">
    <circle className={styles.outerAura} cx={x} cy={y} r={radius + 14} fill="#ef6c32" />
    <circle className={styles.innerAura} cx={x} cy={y} r={radius + 9} fill="#f6a545" />
    <polygon className={styles.embers} points={points} fill="#ed8b3f" stroke="#ffbe69" strokeWidth=".6" />
    <circle cx={x} cy={y} r={radius + 4} fill="#25130d" stroke="#9e471e" strokeWidth="5" />
    <circle data-map-boss-bezel cx={x} cy={y} r={radius + 4} fill="none" stroke="#ffc36b" strokeWidth="2.2" strokeDasharray="11 4 3 4" />
    <circle cx={x} cy={y} r={radius + 6.5} fill="none" stroke="#ffb250" strokeOpacity=".5" strokeWidth=".7" />
  </g>;
}

/** A screen-readable badge, bounded in map units to avoid covering nearby placements. */
export function QuestMapBossEmblem({ x, y, labelUnit = 1 }: { x: number; y: number; labelUnit?: number }) {
  const unit = Number.isFinite(labelUnit) && labelUnit > 0 ? labelUnit : 1;
  const radius = Math.min(26, Math.max(5.5, 8 * unit));
  return <g data-map-boss-emblem data-radius={radius} aria-hidden="true" pointerEvents="none" className={styles.emblem}
    transform={`translate(${x} ${y}) scale(${radius / 10})`}>
    <circle r="10" fill="#250f0a" stroke="#ffb967" strokeWidth="1" />
    <path d="M0-10c1 4 5 3 4 7 3-1 3-3 3-3 5 8 1 13-6 13S-9 2-6-3c0 3 3 2 3 0 0-2 1-5 3-7Z" fill="#ed622c" />
    <path d="M1-7c0 3 3 4 2 6 2-1 3 1 2 4-1 3-7 4-10 1-2-3 0-5 2-7 0 2 2 3 2 1 0-2 1-3 2-5Z" fill="#ffb13f" />
    <path d="M0-3c-3 0-5 2-5 4 0 2 1 3 2 3v3h6V4c1 0 2-1 2-3 0-2-2-4-5-4Z" fill="#fff0d0" />
    <path d="M-3 1h1M2 1h1M0 4v1" stroke="#582111" strokeWidth="1.5" strokeLinecap="round" />
  </g>;
}
