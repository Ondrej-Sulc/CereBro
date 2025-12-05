import { ChampionClass } from "@prisma/client";

export const CLASS_COLORS: Record<string, string> = {
  Science: '#4ade80', // green-400
  Skill: '#ef4444',   // red-500
  Mutant: '#facc15',  // yellow-400
  Cosmic: '#22d3ee',  // cyan-400
  Tech: '#3b82f6',    // blue-500
  Mystic: '#a855f7',  // purple-500
  Superior: '#d946ef', // fuchsia-500
  // Fallback
  Unknown: '#94a3b8',
};

export const getClassColor = (championClass: string | null | undefined): string => {
  if (!championClass) return CLASS_COLORS.Unknown;
  // Handle case sensitivity just in case (API usually returns PascalCase or UPPERCASE)
  // Try direct match first
  if (CLASS_COLORS[championClass]) return CLASS_COLORS[championClass];
  
  // Try Capitalized
  const cap = championClass.charAt(0).toUpperCase() + championClass.slice(1).toLowerCase();
  if (CLASS_COLORS[cap]) return CLASS_COLORS[cap];

  // Try Uppercase key mapping if needed (prisma enum is UPPERCASE)
  const upperMap: Record<string, string> = {
      SCIENCE: 'Science',
      SKILL: 'Skill',
      MUTANT: 'Mutant',
      COSMIC: 'Cosmic',
      TECH: 'Tech',
      MYSTIC: 'Mystic',
      SUPERIOR: 'Superior'
  };
  
  if (upperMap[championClass]) return CLASS_COLORS[upperMap[championClass]];

  return CLASS_COLORS.Unknown;
};
