import { Gauge, ShieldCheck, UsersRound, Zap } from "lucide-react";
import type { QuestPreparation } from "@cerebro/core/domain/game-quests/quest-details";
import styles from "./quest-preparation.module.css";

function teamSizeLabel(minimum?: number, maximum?: number): string | undefined {
  const min = minimum !== undefined && minimum > 0 ? minimum : undefined;
  const max = maximum !== undefined && maximum > 0 ? maximum : undefined;
  if (min !== undefined && max !== undefined) {
    return min === max ? `${min} ${min === 1 ? "champion" : "champions"}` : `${min}–${max} champions`;
  }
  if (min !== undefined && min > 1) return `At least ${min} champions`;
  if (max !== undefined) return `Up to ${max} ${max === 1 ? "champion" : "champions"}`;
  return undefined;
}

export function QuestPreparationSummary({ preparation }: { preparation?: QuestPreparation }) {
  if (!preparation) return null;

  const { energyPerTile, recommendedTeamRating, championRequirement } = preparation;
  const teamSize = teamSizeLabel(preparation.minTeamSize, preparation.maxTeamSize);
  const requirement = championRequirement?.label.trim() ? championRequirement.label : undefined;
  const hasMetrics = energyPerTile !== undefined || recommendedTeamRating !== undefined || teamSize !== undefined;
  if (!hasMetrics && !requirement) return null;

  return <section className={styles.summary} aria-label="Quest preparation" data-quest-preparation>
    {hasMetrics && <dl className={styles.metrics}>
      {energyPerTile !== undefined && <div className={styles.metric}>
        <dt><Zap size={13} aria-hidden="true" />Energy per tile</dt>
        <dd className={styles.energy}>{energyPerTile}</dd>
      </div>}
      {recommendedTeamRating !== undefined && <div className={styles.metric}>
        <dt><Gauge size={13} aria-hidden="true" />Recommended team rating</dt>
        <dd>{recommendedTeamRating.toLocaleString("en-US")}</dd>
      </div>}
      {teamSize && <div className={styles.metric}>
        <dt><UsersRound size={13} aria-hidden="true" />Team size</dt>
        <dd className={styles.teamSize}>{teamSize}</dd>
      </div>}
    </dl>}
    {requirement && <div className={styles.requirement} data-champion-requirement>
      <p className={styles.requirementLabel}><ShieldCheck size={14} aria-hidden="true" />Champion requirement</p>
      <p className={styles.requirementText}><strong>{requirement}</strong></p>
    </div>}
  </section>;
}
