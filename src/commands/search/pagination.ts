import { ChampionWithRelations, RosterEntryWithChampionRelations } from "../../types/search";

const CONTENT_LIMIT = 3800; // 5% buffer under Discord's 4000 character limit per message segment

export function paginate<T extends ChampionWithRelations | RosterEntryWithChampionRelations>(
  items: T[],
  getLength: (item: T) => number,
  contentLimit = CONTENT_LIMIT
): T[][] {
  const pages: T[][] = [];
  let currentPage: T[] = [];
  let currentLength = 0;

  for (const item of items) {
    const itemLength = getLength(item);
    if (currentPage.length && currentLength + itemLength > contentLimit) {
      pages.push(currentPage);
      currentPage = [];
      currentLength = 0;
    }
    currentPage.push(item);
    currentLength += itemLength;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}
