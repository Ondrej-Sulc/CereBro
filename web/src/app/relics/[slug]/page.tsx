import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getRelicCatalog,
  getRelicDetails,
  getRelicFamilyDetails,
} from "@/lib/data/relics";
import { RelicDetails } from "./relic-details";
import { getPlayerRelicInventory } from "@/lib/data/player-relics";
import { RelicInventoryProvider } from "@/components/relics/relic-inventory";
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
  const [family, inventory, catalog] = await Promise.all([
    getRelicFamilyDetails(slug),
    getPlayerRelicInventory(),
    getRelicCatalog(),
  ]);
  if (!family) notFound();
  const ids = new Set(family.members.map((member) => member.relic.id));
  const choices = catalog.families
    .flatMap((group) => group.variants)
    .filter((relic) => ids.has(relic.id));
  return (
    <RelicInventoryProvider
      key={inventory.profile?.id ?? "guest"}
      initial={inventory}
      choices={choices}
      attributeIcons={catalog.attributeIcons}
    >
      <RelicDetails family={family} />
    </RelicInventoryProvider>
  );
}
