import { DuelStatus } from "@prisma/client";
import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import type { ChampionWithAllRelations } from "../../services/championService";
import { createPaginationActionRow } from "./actionRow";
import { getAbilitiesContent } from "./abilities";
import { getAttacksContent } from "./attacks";
import { addDuelComponents, getDuelContent } from "./duel";
import { getImmunitiesContent } from "./immunities";
import { getInfoContent } from "./info";
import { getOverviewContent } from "./overview";
import { paginateChampionText, type ChampionContentPage } from "./pagination";
import { getTagsContent } from "./tags";

export function getChampionViewContent(
  champion: ChampionWithAllRelations,
  view: string,
  resolveEmoji: (text: string) => string,
  page = 1
): ChampionContentPage {
  let content: string;
  switch (view) {
    case "info":
      return getInfoContent(champion, page);
    case "abilities":
      content = getAbilitiesContent(champion, resolveEmoji);
      break;
    case "immunities":
      content = getImmunitiesContent(champion, resolveEmoji);
      break;
    case "attacks":
      content = getAttacksContent(champion);
      break;
    case "tags":
      content = getTagsContent(champion);
      break;
    case "duel":
      content = getDuelContent(champion.duels.filter(duel =>
        duel.status === DuelStatus.ACTIVE || duel.status === DuelStatus.OUTDATED
      ), resolveEmoji);
      break;
    default: {
      const overview = getOverviewContent(champion, resolveEmoji);
      content = typeof overview === "string" ? overview : overview
        .map(section => `## ${section.title}\n${section.content}`).join("\n\n");
    }
  }
  return paginateChampionText(content, page);
}

/** All entry points use the same page budget, view formatting and navigation. */
export function addChampionViewContent(
  container: ContainerBuilder,
  champion: ChampionWithAllRelations,
  view: string,
  resolveEmoji: (text: string) => string,
  page = 1
): void {
  const { content, currentPage, totalPages } = getChampionViewContent(champion, view, resolveEmoji, page);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  if (totalPages > 1) {
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addActionRowComponents(createPaginationActionRow(String(champion.id), view, currentPage, totalPages));
  }
  if (view === "duel") addDuelComponents(container, champion, resolveEmoji);
}
