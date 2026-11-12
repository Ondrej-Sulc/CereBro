import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTowerCatalog } from "@/lib/game-towers";
import { TowerCard } from "./tower-catalog";
import styles from "./towers.module.css";

export async function TowerDiscovery() {
  const towers = await getTowerCatalog();
  return <section className={styles.discovery} aria-labelledby="tower-discovery-heading"><div className={styles.sectionHeading}><div><h2 id="tower-discovery-heading">Towers</h2></div><Link href="/quests/towers" className={styles.discoveryLink}>Explore all Towers <ArrowRight size={15} aria-hidden="true"/></Link></div><p className={styles.discoveryIntro}>Browse Class, Challenge and Event Towers, defenders, nodes and rewards.</p><div className={styles.posterGrid}>{towers.map((tower, index) => <TowerCard key={tower.id} tower={tower} index={index}/>)}</div></section>;
}
