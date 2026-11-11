import type { Metadata } from 'next';
import { loadEffectGlossary } from '@/lib/data/effect-glossary';
import type { GlossaryParams } from '@/lib/effect-glossary';
import { GlossaryCatalogView } from './glossary-views';

export const metadata: Metadata = { title: 'Effect glossary | CereBro', description: 'Explore MCOC effects, their definitions, champion sources, immunities and resistances.' };
export default async function GlossaryPage({ searchParams }: { searchParams: Promise<GlossaryParams> }) {
  return <GlossaryCatalogView data={await loadEffectGlossary(await searchParams)} />;
}
