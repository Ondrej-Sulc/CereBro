import { ChampionClass } from '@prisma/client';

export const championClassColorMap: Record<ChampionClass, { text: string; border: string; bg: string; color: string }> = {
  SCIENCE:  { text: 'text-green-500',  border: 'ring-2 ring-inset ring-green-500/75',  bg: 'bg-green-500/10',  color: '#22c55e' }, // green-500
  SKILL:    { text: 'text-red-500',    border: 'ring-2 ring-inset ring-red-500/75',    bg: 'bg-red-500/10',    color: '#ef4444' },   // red-500
  MYSTIC:   { text: 'text-purple-600', border: 'ring-2 ring-inset ring-purple-600/75', bg: 'bg-purple-600/10', color: '#9333ea' }, // purple-600
  COSMIC:   { text: 'text-cyan-500',   border: 'ring-2 ring-inset ring-cyan-500/75',   bg: 'bg-cyan-500/10',   color: '#06b6d4' },  // cyan-500
  TECH:     { text: 'text-blue-700',   border: 'ring-2 ring-inset ring-blue-700/75',   bg: 'bg-blue-700/10',   color: '#1d4ed8' },  // blue-700
  MUTANT:   { text: 'text-yellow-500', border: 'ring-2 ring-inset ring-yellow-500/75', bg: 'bg-yellow-500/10', color: '#eab308' }, // yellow-500
  SUPERIOR: { text: 'text-gray-400',   border: 'ring-2 ring-inset ring-gray-400/75',   bg: 'bg-gray-400/10',   color: '#9ca3af' },  // gray-400
};

export const getChampionClassColors = (championClass?: ChampionClass) => {
  return championClass ? championClassColorMap[championClass] : { text: 'text-white', border: 'border-gray-500/50', bg: 'bg-gray-500/10', color: '#ffffff' };
};
