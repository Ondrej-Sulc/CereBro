'use client';
export default function GlossaryError({ reset }: { reset: () => void }) {
  return <div role="alert" className="mx-auto max-w-xl px-6 py-20"><h1 className="text-2xl font-semibold">The glossary couldn’t load</h1><p className="my-4 text-slate-400">Try again to load the recorded effect catalog.</p><button onClick={reset} className="rounded-lg border border-slate-600 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300">Try again</button></div>;
}
