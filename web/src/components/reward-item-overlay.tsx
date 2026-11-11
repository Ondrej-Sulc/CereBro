import { ArrowRight, Star } from "lucide-react";
import type { RewardRankChange } from "@cerebro/core/data/game-reward-presentation";
import styles from "./reward-item-overlay.module.css";

/** Native item details are decorative; the adjacent item name includes them. */
export function RewardItemOverlay({ rank, signaturePoints, rarity }: {
  rank?: RewardRankChange;
  signaturePoints?: number;
  rarity?: number;
}) {
  const points = typeof signaturePoints === "number" && Number.isSafeInteger(signaturePoints) && signaturePoints > 0 ? signaturePoints : undefined;
  if (!rank && !points) return null;
  const stars = typeof rarity === "number" && Number.isInteger(rarity) && rarity > 0 && rarity <= 12 ? rarity : 0;
  return <span aria-hidden="true" className={styles.overlay} data-reward-item-overlay>
    {rank && <span className={styles.rank} data-reward-rank={`${rank.from}-${rank.to}`}
      data-wide-rank={Math.max(rank.from, rank.to) >= 10 || undefined}>
      <span>{rank.from}</span><ArrowRight className={styles.arrow} strokeWidth={3.5}/><span>{rank.to}</span>
    </span>}
    {points && <span className={styles.signature} data-reward-signature-points={points}
      data-wide-signature={String(points).length > 2 || undefined}>+{points}</span>}
    {stars > 0 && <span className={styles.stars} data-reward-stars={stars}>
      {Array.from({ length: stars }, (_, index) => <Star key={index} className={styles.star}
        style={{ width: `${Math.min(12, 84 / stars)}cqw` }} fill="currentColor" strokeWidth={1.4}/>)}
    </span>}
  </span>;
}
