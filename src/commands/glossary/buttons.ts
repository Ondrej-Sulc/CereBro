import {
  ButtonInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from "discord.js";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import { handleCategory } from "./category";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { handleList } from "./list";
import { handleEffect } from "./effect";
import crypto from "crypto";
import { findSearchChampions, findSearchRoster } from "../search/data";
import { parseSearchCriteria } from "../search/utils";
import { rosterSearchCache, searchCache } from "../search/cache";
import { paginate } from "../search/pagination";
import { core, rosterCore } from "../search/searchService";
import {
  getChampionDisplayLength,
  getSearchPageLimit,
  getRosterEntryDisplayLength,
} from "../search/views/common";
import { getPlayer } from "../../utils/playerHelper";

async function handleCategoryButton(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const categoryName = interaction.customId.substring(
    "glossary_category_".length
  );
  const resolveEmoji = createEmojiResolver(interaction.client);
  const result = await handleCategory(
    categoryName,
    resolveEmoji,
    interaction.user.id
  );
  await interaction.editReply(result);
}

async function handleListBackButton(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const resolveEmoji = createEmojiResolver(interaction.client);
  const result = await handleList(resolveEmoji);
  await interaction.editReply(result);
}

async function handleEffectButton(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const prefix = "glossary_effect_";
  const content = interaction.customId.substring(prefix.length);
  const parts = content.split("_");
  const categoryName = parts.pop();
  const effectName = parts.join("_");
  const resolveEmoji = createEmojiResolver(interaction.client);
  const result = await handleEffect(
    effectName,
    resolveEmoji,
    interaction.user.id,
    categoryName
  );
  await interaction.editReply(result);
}

async function handleBackToCategoryButton(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const categoryName = interaction.customId.substring(
    "glossary_back_category_".length
  );
  const resolveEmoji = createEmojiResolver(interaction.client);
  const result = await handleCategory(
    categoryName,
    resolveEmoji,
    interaction.user.id
  );
  await interaction.editReply(result);
}

async function handleSearchButton(interaction: ButtonInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const customIdContent = interaction.customId.substring(
    "glossary_search_".length
  );
  const [searchType, ...effectNameParts] = customIdContent.split("_");
  const effectName = effectNameParts.join("_");

  const searchId = crypto.randomUUID();
  const searchCriteria = {
    abilities: searchType === "ability" ? effectName : null,
    immunities: searchType === "immunity" ? effectName : null,
    tags: null,
    championClass: null,
    abilityCategory: null,
    attackType: null,
  };

  const allChampions = await findSearchChampions(searchCriteria);

  if (allChampions.length === 0) {
    await interaction.editReply(
      `No champions found with the effect "${effectName}".`
    );
    return;
  }

  const parsedSearchCriteria = parseSearchCriteria(searchCriteria);

  const pages = paginate(allChampions, (champion) =>
    getChampionDisplayLength(champion, parsedSearchCriteria), getSearchPageLimit(searchCriteria, allChampions.length)
  );
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

async function handleCategorySearchButton(interaction: ButtonInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const categoryName = interaction.customId.substring(
    "glossary_search_category_".length
  );

  const searchId = crypto.randomUUID();
  const searchCriteria = {
    abilities: null,
    immunities: null,
    tags: null,
    championClass: null,
    abilityCategory: categoryName,
    attackType: null,
  };

  const allChampions = await findSearchChampions(searchCriteria);

  if (allChampions.length === 0) {
    await interaction.editReply(
      `No champions found in the category "${categoryName}".`
    );
    return;
  }

  const parsedSearchCriteria = parseSearchCriteria(searchCriteria);

  const pages = paginate(allChampions, (champion) =>
    getChampionDisplayLength(champion, parsedSearchCriteria), getSearchPageLimit(searchCriteria, allChampions.length)
  );
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

async function handleRosterSearchEffectButton(interaction: ButtonInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const customIdContent = interaction.customId.substring(
    "glossary_roster_search_".length
  );
  const [searchType, ...effectNameParts] = customIdContent.split("_");
  const effectName = effectNameParts.join("_");

  const searchId = crypto.randomUUID();
  const searchCriteria = {
    abilities: searchType === "ability" ? effectName : null,
    immunities: searchType === "immunity" ? effectName : null,
    tags: null,
    championClass: null,
    abilityCategory: null,
    attackType: null,
  };

  const player = await getPlayer(interaction);

  if (!player) {
    return;
  }

  const rosterEntries = await findSearchRoster(player.id, searchCriteria);

  if (rosterEntries.length === 0) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `No champions found in your roster with the effect "${effectName}".`
      )
    );
    await interaction.editReply({
      components: [container],
      flags: [MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral],
    });
    return;
  }

  const parsedSearchCriteria = parseSearchCriteria(searchCriteria);

  const pages = paginate(rosterEntries, (entry) =>
    getRosterEntryDisplayLength(entry, parsedSearchCriteria), getSearchPageLimit(searchCriteria, rosterEntries.length, true)
  );
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

async function handleRosterSearchCategoryButton(interaction: ButtonInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const categoryName = interaction.customId.substring(
    "glossary_roster_search_category_".length
  );

  const searchId = crypto.randomUUID();
  const searchCriteria = {
    abilities: null,
    immunities: null,
    tags: null,
    championClass: null,
    abilityCategory: categoryName,
    attackType: null,
  };

  const player = await getPlayer(interaction);

  if (!player) {
    return;
  }

  const rosterEntries = await findSearchRoster(player.id, searchCriteria);

  if (rosterEntries.length === 0) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `No champions found in your roster in the category "${categoryName}".`
      )
    );
    await interaction.editReply({
      components: [container],
      flags: [MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral],
    });
    return;
  }

  const parsedSearchCriteria = parseSearchCriteria(searchCriteria);

  const pages = paginate(rosterEntries, (entry) =>
    getRosterEntryDisplayLength(entry, parsedSearchCriteria), getSearchPageLimit(searchCriteria, rosterEntries.length, true)
  );
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

export function registerGlossaryButtons() {
  registerButtonHandler("glossary_category_", handleCategoryButton);
  registerButtonHandler("glossary_list_back", handleListBackButton);
  registerButtonHandler("glossary_effect_", handleEffectButton);
  registerButtonHandler("glossary_back_category_", handleBackToCategoryButton);
  registerButtonHandler("glossary_search_category_", handleCategorySearchButton);
  registerButtonHandler("glossary_search_", handleSearchButton);
  registerButtonHandler(
    "glossary_roster_search_category_",
    handleRosterSearchCategoryButton
  );
  registerButtonHandler("glossary_roster_search_", handleRosterSearchEffectButton);
}