"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type SortOption = { value: string; label: string; href: string };

/** The native select also belongs to the search GET form when JavaScript is unavailable. */
export function QuestOpponentSort({ value, options, formId, className }: {
  value: string;
  options: readonly SortOption[];
  formId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <label className={className} aria-busy={pending}>
    <span>Sort within groups</span>
    <select name="sort" form={formId} value={value} disabled={pending} onChange={event => {
      const option = options.find(item => item.value === event.currentTarget.value);
      if (!option) return;
      const target = new URL(option.href, window.location.origin);
      const form = document.getElementById(formId);
      const query = form instanceof HTMLFormElement ? new FormData(form).get("q") : null;
      if (typeof query === "string") target.searchParams.set("q", query);
      target.searchParams.delete("page");
      startTransition(() => router.push(`${target.pathname}?${target.searchParams}`));
    }}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {pending && <span className="sr-only" role="status">Sorting encounters…</span>}
  </label>;
}
