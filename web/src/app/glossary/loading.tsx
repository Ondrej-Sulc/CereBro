import { GlossaryShell } from './glossary-views';
export default function LoadingGlossary() {
  return <GlossaryShell><div role="status" className="space-y-5 py-12 motion-safe:animate-pulse"><p className="text-sm text-slate-400">Loading effect glossary…</p><div className="h-12 w-2/3 rounded bg-slate-800" /><div className="h-20 rounded-xl bg-slate-800/50" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(id => <div key={id} className="h-48 rounded-xl bg-slate-800/50" />)}</div></div></GlossaryShell>;
}
