import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from "discord.js";
import crypto from "crypto";
import {
  RosterEntryWithChampionRelations,
  SearchCoreParams,
} from "../../types/search";
import { buildSearchWhereClause, parseAndOrConditions } from "./queryBuilder";
import { rosterSearchCache } from "./cache";
import { paginate } from "./pagination";
import { rosterCore } from "./searchService";
import { getRosterEntryDisplayLength } from "./views/common";
import { getPlayer } from "../../utils/playerHelper";



async function handleRosterSearch(interaction: ChatInputCommandInteraction) {
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

  const player = await getPlayer(interaction);

  if (!player) {
    return;
  }

  const where = await buildSearchWhereClause(searchCriteria);
  const rosterEntries = await prisma.roster.findMany({
    where: {
      playerId: player.id,
      champion: where,
    },
    include: {
      champion: {
        include: {
          tags: true,
          abilities: {
            include: { ability: { include: { categories: true } } },
          },
          attacks: { include: { hits: true } },
        },
      },
    },
    orderBy: [
      { stars: "desc" },
      { rank: "desc" },
      { champion: { name: "asc" } },
    ],
  });

  if (rosterEntries.length === 0) {
    await interaction.editReply({
      content: "No champions found in the roster matching your criteria.",
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

  const pages = paginate<RosterEntryWithChampionRelations>(rosterEntries, (entry) => getRosterEntryDisplayLength(entry, parsedSearchCriteria));
  rosterSearchCache.set(searchId, { criteria: searchCriteria, pages });
  setTimeout(() => rosterSearchCache.delete(searchId), 15 * 60 * 1000); // 15 min expiry

  const result = await rosterCore(
    interaction.client,
    interaction.guild,
    pages[0],
    searchCriteria,
    rosterEntries.length,
    1,
    pages.length,
    searchId,
    interaction.user.id
  );

  await interaction.editReply(result);
}

async function handleRosterSearchPagination(interaction: ButtonInteraction) {
  const [_, direction, searchId, currentPageStr] = 
    interaction.customId.split(":");
  const currentPage = parseInt(currentPageStr, 10);
  const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;

  const cachedSearch = rosterSearchCache.get(searchId);

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
  const result = await rosterCore(
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

export { handleRosterSearch, handleRosterSearchPagination };
