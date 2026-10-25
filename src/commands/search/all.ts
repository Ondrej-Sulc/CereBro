import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from "discord.js";
import crypto from "crypto";
import { readSearchCriteria, parseSearchCriteria } from "./utils";
import {
  ChampionWithRelations,
} from "../../types/search";
import { findSearchChampions } from "./data";
import { searchCache } from "./cache";
import { paginate } from "./pagination";
import { core } from "./searchService";
import { getChampionDisplayLength, getSearchPageLimit } from "./views/common";



async function handleGlobalSearch(interaction: ChatInputCommandInteraction) {
  const searchId = crypto.randomUUID();
  const searchCriteria = readSearchCriteria(interaction);

  if (Object.values(searchCriteria).every(value => value == null || value === "" || value === false)) {
    await interaction.editReply({
      content: "You must provide at least one search criteria.",
    });
    return;
  }

  const allChampions = await findSearchChampions(searchCriteria);

  if (allChampions.length === 0) {
    await interaction.editReply({
      content: "No champions found matching your criteria.",
    });
    return;
  }

  const parsedSearchCriteria = parseSearchCriteria(searchCriteria);

  const pages = paginate<ChampionWithRelations>(allChampions, (champion) => getChampionDisplayLength(champion, parsedSearchCriteria), getSearchPageLimit(searchCriteria, allChampions.length));
  searchCache.set(searchId, { criteria: searchCriteria, pages });
  setTimeout(() => searchCache.delete(searchId), 15 * 60 * 1000); // 15 min expiry

  const result = await core(
    interaction.client,
    interaction.guild,
    pages[0],
    searchCriteria,
    allChampions.length,
    1,
    pages.length,
    searchId,
    interaction.user.id
  );

  await interaction.editReply(result);
}

async function handleSearchPagination(interaction: ButtonInteraction) {
  const [_, direction, searchId, currentPageStr] = 
    interaction.customId.split(":");
  const currentPage = parseInt(currentPageStr, 10);
  const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;

  const cachedSearch = searchCache.get(searchId);

  if (!cachedSearch) {
    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "This search has expired. Please run the command again."
      )
    );
    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  const { criteria, pages } = cachedSearch;
  const totalPages = pages.length;

  if (newPage < 1 || newPage > totalPages) {
    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Invalid page number.")
    );
    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  await interaction.deferUpdate();
  const result = await core(
    interaction.client,
    interaction.guild,
    pages[newPage - 1],
    criteria,
    pages.flat().length,
    newPage,
    totalPages,
    searchId,
    interaction.user.id
  );
  await interaction.editReply(result);
}

export { handleGlobalSearch, handleSearchPagination };
