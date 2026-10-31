'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

export function LocalDate({ value }: { value: Date | string }) {
  const date = new Date(value);
  const iso = Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
  const fallback = iso?.slice(0, 10) ?? '—';
  const text = useSyncExternalStore(subscribe,
    () => iso ? date.toLocaleDateString() : fallback,
    () => fallback,
  );
  return <time dateTime={iso}>{text}</time>;
}
