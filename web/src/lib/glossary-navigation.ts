/** Browser-safe glossary identities and return links. Keep source projection imports out. */
export function glossaryEffectId(value: string): number | null {
  return /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647 ? Number(value) : null;
}

export function normalizeGlossaryReturnTo(value: string): string {
  if (!value || value.length > 2048 || !/^\/glossary(?:[?#]|$)/.test(value)) return '';
  const url = new URL(value, 'https://cerebro.invalid');
  if (url.pathname !== '/glossary') return '';
  const query = new URLSearchParams();
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
  const category = glossaryEffectId(url.searchParams.get('category') ?? '');
  const requestedPage = url.searchParams.get('page') ?? '';
  const page = /^\d{1,6}$/.test(requestedPage) ? Math.max(1, Number(requestedPage)) : 1;
  if (q) query.set('q', q);
  if (category) query.set('category', String(category));
  if (page > 1) query.set('page', String(page));
  return `/glossary${query.size ? `?${query}` : ''}#effects-results`;
}

export const glossaryHref = (id: number, returnTo = '') => {
  const destination = normalizeGlossaryReturnTo(returnTo);
  return `/glossary/${id}${destination ? `?${new URLSearchParams({ returnTo: destination })}` : ''}`;
};
