import type { Metadata } from "next";
import { getRelicCatalog } from "@/lib/data/relics";
import { RelicCatalogBrowser } from "./relic-catalog-browser";
export const metadata: Metadata = {
  title: "Relics | CereBro",
  description:
    "Browse Battlecast and Statcast relics, rune options, striker abilities and stat variants.",
};
export const dynamic = "force-dynamic";
export default async function RelicsPage() {
  return <RelicCatalogBrowser data={await getRelicCatalog()} />;
}
