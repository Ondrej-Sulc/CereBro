import { notFound } from "next/navigation";
import { getTowerCatalog, getTowerBlockView } from "@/lib/game-towers";
import { TowerDetail } from "@/components/game-towers/tower-detail";
import { towerTitle } from "@/components/game-towers/tower-catalog";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const tower = (await getTowerCatalog()).find(t => t.id === id);
  return { title: `${tower ? towerTitle(tower.name) : "Tower"} | CereBro` };
}
export default async function TowerPage({ params, searchParams }: Props) {
  const [{ id }, p] = await Promise.all([params, searchParams]);
  const tower = (await getTowerCatalog()).find(t => t.id === id);
  if (!tower) notFound();
  const requested = typeof p.block === "string" && /^\d+$/.test(p.block) ? Number(p.block) : undefined;
  const current = requested ?? tower.blockNumbers[0] ?? 1;
  const from = typeof p.from === "string" && /^\/quests\/towers(?:\?|$)/.test(p.from) ? p.from : undefined;
  const view = tower.blockNumbers.includes(current) ? await getTowerBlockView(tower.id, current) : null;
  return <TowerDetail tower={tower} view={view} current={current} from={from}/>;
}
