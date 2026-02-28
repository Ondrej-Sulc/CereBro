/**
 * Computes the start and end of a pagination window.
 * @param page Current page number (1-indexed)
 * @param totalPages Total number of pages
 * @param windowSize Desired number of pages to show in the window
 * @returns An object with windowStart and windowEnd (both inclusive)
 */
export function computePaginationWindow(page: number, totalPages: number, windowSize: number = 5) {
  const size = Math.min(windowSize, totalPages);
  const half = Math.floor(size / 2);
  const windowStart = Math.max(1, Math.min(page - half, totalPages - size + 1));
  const windowEnd = windowStart + size - 1;

  return { windowStart, windowEnd };
}
