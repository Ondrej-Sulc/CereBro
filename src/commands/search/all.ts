import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from "discord.js";
import crypto from "crypto";
import {
  SearchCoreParams,
  ChampionWithRelations,
} from "../../types/search";
import { buildSearchWhereClause, parseAndOrConditions } from "./queryBuilder";
import { searchCache } from "./cache";
import { paginate } from "./pagination";
import { core } from "./searchService";
import { getChampionDisplayLength } from "./views/common";



async function handleGlobalSearch(interaction: ChatInputCommandInteraction) {
  const { prisma } = await import("../../services/prismaService.js");
  const searchId = crypto.randomUUID();
  const searchCriteria = {
    abilities: interaction.options.getString("abilities"),
    immunities: interaction.options.getString("immunities"),
    tags: interaction.options.getString("tags"),
    championClass: interaction.options.getString("class"),
    abilityCategory: interaction.options.getString("ability-category"),
    attackType: interaction.options.getString("attack-type"),
  };

  if (Object.values(searchCriteria).every((v) => !v)) {
    await interaction.editReply({
      content: "You must provide at least one search criteria.",
    });
    return;
  }

  const where = await buildSearchWhereClause(searchCriteria);
  const allChampions = await prisma.champion.findMany({
    where,
    include: {
      tags: true,
      abilities: {
        include: {
          ability: { include: { categories: true } },
        },
      },
      attacks: { include: { hits: true } },
    },
    orderBy: { name: "asc" },
  });

  if (allChampions.length === 0) {
    await interaction.editReply({
      content: "No champions found matching your criteria.",
    });
    return;
  }

  const parsedSearchCriteria = {
    abilities: parseAndOrConditions(searchCriteria.abilities).conditions.map(
      (c) => c.toLowerCase()
    ),
    immunities: parseAndOrConditions(searchCriteria.immunities).conditions.map(
      (c) => c.toLowerCase()
    ),
    tags: parseAndOrConditions(searchCriteria.tags).conditions.map((c) =>
      c.toLowerCase()
    ),
    abilityCategory: parseAndOrConditions(
      searchCriteria.abilityCategory
    ).conditions.map((c) => c.toLowerCase()),
    attackType: parseAndOrConditions(searchCriteria.attackType).conditions.map(
      (c) => c.toLowerCase()
    ),
  };

  const pages = paginate<ChampionWithRelations>(allChampions, (champion) => getChampionDisplayLength(champion, parsedSearchCriteria));
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
