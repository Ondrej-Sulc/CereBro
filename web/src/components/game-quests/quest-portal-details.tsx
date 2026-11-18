import { ArrowUpRight, Waypoints } from "lucide-react";
import { gameText, type Coordinate, type QuestTile } from "@cerebro/core/domain/game-quests";
import styles from "./quest-portal-details.module.css";

export function QuestPortalDetails({ tile, choose, positionLabel }: {
  tile: QuestTile; choose: (coordinate: Coordinate, center?: boolean) => void; positionLabel: (coordinate: Coordinate) => string;
}) {
  if (!tile.portals.length) return null;
  return <section className={styles.section} aria-label="Portal destinations">
    <h3><Waypoints size={15} aria-hidden="true"/>{tile.randomPortal ? "Possible portal destinations" : "Portal destinations"}</h3>
    <div className={styles.destinations}>{tile.portals.map((portal, index) => {
      const label = gameText(portal.label).trim(), name = positionLabel(portal.target);
      const destination = ["Portal", "Map location", "Junction"].includes(name) ? `Destination ${index + 1}` : name;
      return <button key={`${portal.target.join(',')}:${index}`} type="button" onClick={() => choose(portal.target, true)} className={styles.destination}>
        <span>{label && label !== destination && <small>{label}</small>}<strong>{destination}</strong></span>
        <ArrowUpRight size={16} aria-hidden="true"/>
      </button>;
    })}</div>
  </section>;
}
