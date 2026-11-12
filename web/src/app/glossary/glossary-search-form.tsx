'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

/** Native history can restore edited fields after restoring an unfiltered result. */
export function GlossarySearchForm({ children, className }: { children: ReactNode; className: string }) {
  const form = useRef<HTMLFormElement>(null);
  const query = useSearchParams()?.toString() ?? '';
  useEffect(() => {
    const sync = () => {
      const control = form.current?.elements.namedItem('q');
      if (control instanceof HTMLInputElement) control.value = (new URLSearchParams(window.location.search).get('q') ?? '').trim().slice(0, 100);
    };
    let frame = 0;
    const restored = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(sync); };
    sync();
    window.addEventListener('pageshow', restored);
    window.addEventListener('popstate', restored);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pageshow', restored);
      window.removeEventListener('popstate', restored);
    };
  }, [query]);
  return <form ref={form} action="/glossary#effects-results" method="get" className={className} role="search" aria-label="Search effects">{children}</form>;
}
