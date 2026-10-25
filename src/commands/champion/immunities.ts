import { ChampionWithAllRelations } from "../../services/championService";
import { projectChampionEffects } from "../../domain/champion-effects";
import { formatImmunities } from "./view";
import { prepareChampionEffectDisplay } from "./effect-display";

export function getImmunitiesContent(
  champion: ChampionWithAllRelations,
  resolveEmoji: (text: string) => string
): string {
  const relevantAbilities = projectChampionEffects(champion.abilities, champion.abilityTexts).filter(
    a => a.type === "IMMUNITY" || a.type === "RESISTANCE"
  );

  return formatImmunities(relevantAbilities, resolveEmoji, prepareChampionEffectDisplay(champion));
}
