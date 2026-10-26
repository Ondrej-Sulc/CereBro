import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRelicDetails } from "@/lib/data/relics";
import { RelicDetails } from "./relic-details";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getRelicDetails(slug);
  return {
    title: data ? `${data.relic.name} | CereBro` : "Relic not found | CereBro",
  };
}
export default async function RelicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getRelicDetails(slug);
  if (!data) notFound();
  return <RelicDetails key={data.relic.id} data={data} />;
}
