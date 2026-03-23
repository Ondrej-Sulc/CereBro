import { ChampionClass } from '@prisma/client';

export const championClassColorMap: Record<ChampionClass, { text: string; border: string; bg: string; color: string; hoverBorder: string }> = {
  SCIENCE:  { text: 'text-green-500',  border: 'ring-2 ring-inset ring-green-500/75',  bg: 'bg-green-500/20',  color: '#22c55e', hoverBorder: 'hover:border-green-500/50' }, // green-500
  SKILL:    { text: 'text-red-500',    border: 'ring-2 ring-inset ring-red-500/75',    bg: 'bg-red-500/20',    color: '#ef4444', hoverBorder: 'hover:border-red-500/50' },   // red-500
  MYSTIC:   { text: 'text-purple-600', border: 'ring-2 ring-inset ring-purple-600/75', bg: 'bg-purple-600/20', color: '#9333ea', hoverBorder: 'hover:border-purple-600/50' }, // purple-600
  COSMIC:   { text: 'text-cyan-500',   border: 'ring-2 ring-inset ring-cyan-500/75',   bg: 'bg-cyan-500/20',   color: '#06b6d4', hoverBorder: 'hover:border-cyan-500/50' },  // cyan-500
  TECH:     { text: 'text-blue-700',   border: 'ring-2 ring-inset ring-blue-700/75',   bg: 'bg-blue-700/20',   color: '#1d4ed8', hoverBorder: 'hover:border-blue-700/50' },  // blue-700
  MUTANT:   { text: 'text-yellow-500', border: 'ring-2 ring-inset ring-yellow-500/75', bg: 'bg-yellow-500/20', color: '#eab308', hoverBorder: 'hover:border-yellow-500/50' }, // yellow-500
  SUPERIOR: { text: 'text-emerald-500',   border: 'ring-2 ring-inset ring-emerald-500/75',   bg: 'bg-emerald-500/20',   color: '#10b981', hoverBorder: 'hover:border-emerald-500/50' },  // emerald-500
};

export const getChampionClassColors = (championClass?: ChampionClass) => {
  return championClass ? championClassColorMap[championClass] : { text: 'text-white', border: 'ring-2 ring-inset ring-gray-500/50', bg: 'bg-gray-500/10', color: '#ffffff', hoverBorder: 'hover:border-gray-500/50' };
};
