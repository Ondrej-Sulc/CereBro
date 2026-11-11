import { EmptyState, GlossaryShell } from './glossary-views';
export default function EffectNotFound() {
  return <GlossaryShell><EmptyState title="Effect not found" description="This effect link does not match a recorded catalog identity." href="/glossary" label="Browse the glossary" /></GlossaryShell>;
}
