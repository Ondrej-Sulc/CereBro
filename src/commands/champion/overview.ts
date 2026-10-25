import {
  ChampionWithAllRelations,
} from "../../services/championService";
import { projectChampionEffects } from "../../domain/champion-effects";
import { prepareChampionEffectDisplay } from "./effect-display";
import {
  formatLinkedAbilitySection,
  formatAttacks,
  formatTags,
} from "./view";

export interface OverviewSection {
  title: string;
  content: string;
}

export function getOverviewContent(
  champion: ChampionWithAllRelations,
  resolveEmoji: (text: string) => string
): OverviewSection[] | string {
  const effects = projectChampionEffects(champion.abilities, champion.abilityTexts);
  const display = prepareChampionEffectDisplay(champion);
  const abilities = effects.filter(a => a.type === "ABILITY");
  const immunities = effects.filter(a => a.type === "IMMUNITY" || a.type === "RESISTANCE");

  const sections: OverviewSection[] = [];

  if (abilities.length > 0) {
    sections.push({
      title: "Abilities",
      content: formatLinkedAbilitySection(abilities, resolveEmoji, "Abilities", 'compact', display),
    });
  }

  if (immunities.length > 0) {
    sections.push({
      title: "Immunities & resistances",
      content: formatLinkedAbilitySection(immunities, resolveEmoji, "Immunities", 'compact', display),
    });
  }

  if (champion.tags.length > 0) {
    sections.push({
      title: "Tags",
      content: formatTags(champion.tags),
    });
  }

  if (champion.attacks.length > 0) {
    sections.push({
      title: "Attacks",
      content: formatAttacks(champion.attacks, 'compact'),
    });
  }

  if (sections.length === 0) {
    return "This champion has no listed abilities, immunities, tags, or attacks.";
  }

  return sections;
}
