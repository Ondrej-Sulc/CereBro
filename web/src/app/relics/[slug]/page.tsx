import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRelicDetails, getRelicFamilyDetails } from "@/lib/data/relics";
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
  const family = await getRelicFamilyDetails(slug);
  if (!family) notFound();
  return <RelicDetails family={family} />;
}
