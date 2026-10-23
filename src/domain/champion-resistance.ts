export const RESISTANCE_MECHANISMS = ['RESISTANCE', 'POTENCY', 'DAMAGE', 'DURATION', 'POTENCY_AND_DURATION'] as const;
export type ResistanceMechanism = typeof RESISTANCE_MECHANISMS[number];
export type ResistanceValueRecord = { id: number | string; group: string; title: string | null; sortOrder?: number; template: unknown };
export type ResistanceDetail = { mechanism: ResistanceMechanism; percent: number | null; valueRecords?: ResistanceValueRecord[] };
const labels: Record<ResistanceMechanism, string> = {
  RESISTANCE: 'resistance', POTENCY: 'potency reduction', DAMAGE: 'damage reduction',
  DURATION: 'duration reduction', POTENCY_AND_DURATION: 'potency and duration reduction',
};

/** A percentage describes its recorded mechanism. It never establishes immunity. */
export function resistanceLabel(detail: ResistanceDetail): string {
  return `${detail.percent === null ? '' : `${detail.percent}% `}${labels[detail.mechanism]}`;
}

export function isResistanceMechanism(value: string): value is ResistanceMechanism {
  return (RESISTANCE_MECHANISMS as readonly string[]).includes(value);
}
