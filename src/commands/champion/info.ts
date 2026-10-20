import { ChampionWithAllRelations } from "../../services/championService";
import { FullAbilities } from "./view";
import { paginateChampionText, type ChampionContentPage } from "./pagination";

export function getInfoContent(
  champion: ChampionWithAllRelations,
  page: number = 1
): ChampionContentPage {
  const fullAbilities = champion.fullAbilities as FullAbilities;

  if (
    !fullAbilities ||
    (!fullAbilities.signature && !fullAbilities.abilities_breakdown)
  ) {
    return {
      content: `Detailed abilities are not available for ${champion.name}.`,
      currentPage: 1,
      totalPages: 1,
    };
  }

  let fullText = "";
  const addBlock = (title: string, description: string) => {
    fullText += `**${title}**\n${description}\n\n`;
  };

  if (fullAbilities.signature) {
    const sig = fullAbilities.signature;
    addBlock(
      sig.name || "Signature Ability",
      sig.description || "No description."
    );
  }

  if (fullAbilities.abilities_breakdown) {
    for (const abilityBlock of fullAbilities.abilities_breakdown) {
      addBlock(
        abilityBlock.title || "Ability",
        abilityBlock.description || "No description."
      );
    }
  }

  return paginateChampionText(fullText, page);
}
