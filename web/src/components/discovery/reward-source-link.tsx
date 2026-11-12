import { rewardSourcesHref } from "@cerebro/core/domain/game-discovery";

const grantTypes = new Set(["hero", "gs", "gf", "res", "ebp", "ebpf", "inv", "sra", "utitle", "profilebadge", "emote"]);
export function RewardSourceLink({ type, token }: { type?: string; token: string }) {
  if (!type || !grantTypes.has(type) || !token || token === "unknown_rewards") return null;
  return <a href={rewardSourcesHref(type, token)} className="inline-flex min-h-11 items-center text-xs text-sky-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-200">Where to earn ↗</a>;
}
