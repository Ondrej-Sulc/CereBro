import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getGlossaryEffect, loadGlossaryDetail } from '@/lib/data/effect-glossary';
import type { GlossaryParams } from '@/lib/effect-glossary';
import { GlossaryDetailView } from '../glossary-views';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<GlossaryParams> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const effect = await getGlossaryEffect((await params).id);
  return { title: effect ? `${effect.name} · Effect glossary | CereBro` : 'Effect not found | CereBro', description: effect?.description ?? undefined };
}
export default async function EffectPage({ params, searchParams }: Props) {
  const data = await loadGlossaryDetail((await params).id, await searchParams);
  if (!data) notFound();
  return <GlossaryDetailView data={data} />;
}
