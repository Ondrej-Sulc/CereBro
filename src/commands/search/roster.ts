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
  RosterEntryWithChampionRelations,
} from "../../types/search";
import { findSearchRoster } from "./data";
import { rosterSearchCache } from "./cache";
import { paginate } from "./pagination";
import { rosterCore } from "./searchService";
import { getRosterEntryDisplayLength, getSearchPageLimit } from "./views/common";
import { getPlayer } from "../../utils/playerHelper";



async function handleRosterSearch(interaction: ChatInputCommandInteraction) {
  const searchId = crypto.randomUUID();
  const searchCriteria = readSearchCriteria(interaction);

  if (Object.values(searchCriteria).every(value => value == null || value === "" || value === false)) {
    await interaction.editReply({
      content: "You must provide at least one search criteria.",
    });
    return;
  }

  const player = await getPlayer(interaction);

  if (!player) {
    return;
  }

  const rosterEntries = await findSearchRoster(player.id, searchCriteria);

  if (rosterEntries.length === 0) {
    await interaction.editReply({
      content: "No champions found in the roster matching your criteria.",
    });
    return;
  }

  const parsedSearchCriteria = parseSearchCriteria(searchCriteria);

  const pages = paginate<RosterEntryWithChampionRelations>(rosterEntries, (entry) => getRosterEntryDisplayLength(entry, parsedSearchCriteria), getSearchPageLimit(searchCriteria, rosterEntries.length, true));
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
