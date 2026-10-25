import { ChampionWithAllRelations } from "../../services/championService";
import { FullAbilities } from "./view";
import { paginateChampionText, type ChampionContentPage } from "./pagination";
import { prepareChampionAbilityTextView, type PreparedChampionAbilityTextNode, type PreparedChampionAbilityTextRecord,
  type PreparedChampionAbilityTextPanel } from "../../domain/champion-ability-text/renderer";

export function getInfoContent(
  champion: ChampionWithAllRelations,
  page: number = 1
): ChampionContentPage {
  if (champion.abilityTexts?.length) {
    return paginateChampionText(formatImportedAbilities(champion), page);
  }
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

function formatImportedAbilities(champion: ChampionWithAllRelations): string {
  const obtainable = new Set(champion.obtainable.map(value => Number(value.match(/^[1-7]/)?.[0])));
  const stat = champion.stats?.filter(row => row.rarity !== null && obtainable.has(row.rarity))
    .sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0) || b.rank - a.rank)[0];
  const maxSig = stat?.rarity && stat.rarity < 5 ? 99 : 200;
  const view = prepareChampionAbilityTextView({ records: champion.abilityTexts ?? [], curves: champion.abilityCurves,
    maxSig, sigLevel: maxSig, stat });
  const parts: string[] = [];
  if (stat) parts.push(`Values shown for ${stat.rarity}★ Rank ${stat.rank}, Sig ${maxSig}.`);
  else parts.push("Values requiring champion stats are unavailable.");
  const recordText = (record: PreparedChampionAbilityTextRecord) => record.prepared.status === "ready"
    ? record.prepared.blocks.map(block => nodeText(block.children)).join("\n")
    : "Ability text unavailable.";
  const addPanel = (panel: PreparedChampionAbilityTextPanel) => {
    if (!panel.records.length) return;
    parts.push(`## ${panel.title}`);
    if (panel.introRecord) parts.push(recordText(panel.introRecord));
    for (const intro of panel.specialAttackIntros ?? []) {
      parts.push(`**Special Attack ${intro.number}${intro.record.displayTitle ? ` — ${intro.record.displayTitle}` : ""}**\n${recordText(intro.record)}`);
    }
    for (const group of panel.recordGroups) {
      parts.push(`**${group.title}**\n${group.records.map(recordText).join("\n")}`);
    }
  };
  addPanel(view.signaturePanel);
  view.descriptionPanels.forEach(addPanel);
  return parts.join("\n\n");
}

function nodeText(nodes: PreparedChampionAbilityTextNode[]): string {
  return nodes.map(node => {
    if (node.type === "text") return node.value;
    if (node.type === "glossary") return node.label;
    if (node.type === "color") return nodeText(node.children);
    return node.resolution.status === "resolved" ? node.resolution.displayValue : "[value unavailable]";
  }).join("");
}
