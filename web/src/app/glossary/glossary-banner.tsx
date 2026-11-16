import Image from 'next/image';
import { BookOpen, Shapes } from 'lucide-react';
import type { CSSProperties } from 'react';
import styles from './glossary-banner.module.css';

// Decorative examples use the same native glyphs and colors as the public catalog.
const sigils = [
  { id: 'amplify', color: '#fc03c6', position: 'center' },
  { id: 'fury', color: '#fc9335', position: 'upper' },
  { id: 'armor_up', color: '#00e4ff', position: 'left' },
  { id: 'bleed', color: '#f71817', position: 'lower' },
  { id: 'regeneration', color: '#00e13f', position: 'right' },
] as const;

export function GlossaryBanner({ effectCount, categoryCount }: { effectCount: number; categoryCount: number }) {
  return <header className={styles.banner} data-glossary-banner>
    <div className={styles.copy}>
      <p className={styles.eyebrow}>Know your effects</p>
      <h1>Effect glossary</h1>
      <p className={styles.intro}>Find effects, champions and counters.</p>
      <div className={styles.stats}>
        <span><BookOpen size={14} aria-hidden="true" /><strong>{effectCount}</strong> {effectCount === 1 ? 'effect' : 'effects'}</span>
        <span><Shapes size={14} aria-hidden="true" /><strong>{categoryCount}</strong> {categoryCount === 1 ? 'category' : 'categories'}</span>
      </div>
    </div>
    <div className={styles.artwork} data-glossary-artwork aria-hidden="true">
      <svg className={styles.orbits} viewBox="0 0 500 280" fill="none" focusable="false">
        <ellipse cx="248" cy="140" rx="190" ry="86" transform="rotate(-18 248 140)" />
        <ellipse cx="248" cy="140" rx="132" ry="112" transform="rotate(28 248 140)" />
        <path d="M70 149 164 62 250 140 350 201 429 117M164 62 429 117M70 149 350 201" />
        <circle cx="99" cy="82" r="2" /><circle cx="323" cy="47" r="2" />
        <circle cx="408" cy="213" r="2" /><circle cx="211" cy="237" r="2" />
      </svg>
      <div className={styles.sigilField}>
        {sigils.map(sigil => <div key={sigil.id} className={styles.sigil} data-sigil-position={sigil.position}
          style={{ '--sigil-color': sigil.color } as CSSProperties}>
          <Image src={`https://storage.googleapis.com/champion-images/mcoc/glossary-icons/${sigil.id}.svg`}
            alt="" width={64} height={64} unoptimized />
        </div>)}
      </div>
    </div>
  </header>;
}
