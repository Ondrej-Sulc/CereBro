// Leave room in the message-wide 4,000-character budget for duel credits/help.
const MAX_PAGE_LENGTH = 3500;

export interface ChampionContentPage {
  content: string;
  currentPage: number;
  totalPages: number;
}

export function paginateChampionText(text: string, page = 1): ChampionContentPage {
  const pages: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_PAGE_LENGTH) {
    const candidate = remaining.slice(0, MAX_PAGE_LENGTH);
    let end = MAX_PAGE_LENGTH;
    // Prefer whole paragraphs, then lines, then words. Keep delimiters so no text is lost.
    for (const delimiter of ["\n\n", "\n", " "]) {
      const boundary = candidate.lastIndexOf(delimiter);
      if (boundary >= MAX_PAGE_LENGTH / 2) {
        end = boundary + delimiter.length;
        break;
      }
    }
    // A single unbroken paragraph may need a hard split; never split a surrogate pair.
    if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
    pages.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining) pages.push(remaining);
  if (pages.length === 0) pages.push("No content for this page.");

  const requestedPage = Number.isFinite(page) ? Math.trunc(page) : 1;
  const pageIndex = Math.max(0, Math.min(requestedPage - 1, pages.length - 1));
  return { content: pages[pageIndex], currentPage: pageIndex + 1, totalPages: pages.length };
}
