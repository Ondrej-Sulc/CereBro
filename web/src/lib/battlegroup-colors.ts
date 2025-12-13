export const BATTLEGROUP_COLORS = {
  1: {
    color: '#ef4444', // Red-500
    className: 'text-red-500',
    bgClassName: 'bg-red-500',
    // New subtle styles
    subtleBg: 'bg-red-500/10',
    subtleBorder: 'border-red-500/50',
    hoverBg: 'hover:bg-red-500/5',
    activeText: 'text-red-400',
  },
  2: {
    color: '#3b82f6', // Blue-500
    className: 'text-blue-500',
    bgClassName: 'bg-blue-500',
    subtleBg: 'bg-blue-500/10',
    subtleBorder: 'border-blue-500/50',
    hoverBg: 'hover:bg-blue-500/5',
    activeText: 'text-blue-400',
  },
  3: {
    color: '#eab308', // Yellow-500
    className: 'text-yellow-500',
    bgClassName: 'bg-yellow-500',
    subtleBg: 'bg-yellow-500/10',
    subtleBorder: 'border-yellow-500/50',
    hoverBg: 'hover:bg-yellow-500/5',
    activeText: 'text-yellow-400',
  }
} as const;

export type BattlegroupNumber = 1 | 2 | 3;

export function getBattlegroupColor(bg: number) {
  return BATTLEGROUP_COLORS[bg as BattlegroupNumber] || {
    color: '#94a3b8',
    className: 'text-slate-400',
    bgClassName: 'bg-slate-500',
    subtleBg: 'bg-slate-500/10',
    subtleBorder: 'border-slate-500/50',
    hoverBg: 'hover:bg-slate-500/5',
    activeText: 'text-slate-200',
  };
}
