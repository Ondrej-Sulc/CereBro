import {
  ChampionWithAllRelations,
} from "../../services/championService";
import { projectChampionEffects } from "../../domain/champion-effects";
import { formatAbilities } from "./view";
import { prepareChampionEffectDisplay } from "./effect-display";

export function getAbilitiesContent(
  champion: ChampionWithAllRelations,
  resolveEmoji: (text: string) => string
): string {
  const relevantAbilities = projectChampionEffects(champion.abilities, champion.abilityTexts).filter(
    a => a.type === "ABILITY"
  );

  return formatAbilities(relevantAbilities, resolveEmoji, prepareChampionEffectDisplay(champion));
}
