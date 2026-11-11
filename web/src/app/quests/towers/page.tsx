import type { Metadata } from "next";
import { getTowerCatalog } from "@/lib/game-towers";
import { TowerCatalog } from "@/components/game-towers/tower-catalog";
export const metadata: Metadata = { title: "Towers | Quest explorer | CereBro", description: "Explore Class, Challenge and Event Towers, floor defenders, block rules and rewards." };
type Params = Record<string, string | string[] | undefined>;
export default async function TowersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const query = typeof p.q === "string" ? p.q.trim() : "";
  const section = p.section === "class" || p.section === "challenge" || p.section === "event" ? p.section : "";
  const status = p.status === "active" || p.status === "archived" || p.status === "unknown" ? p.status : "";
  return <TowerCatalog towers={await getTowerCatalog()} query={query} section={section} status={status}/>;
}
