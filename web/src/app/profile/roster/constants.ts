import { ChampionClass } from "@prisma/client";

export const CLASS_ICONS: Record<Exclude<ChampionClass, 'SUPERIOR'>, string> = {
    SCIENCE: "/icons/Science.png",
    SKILL: "/icons/Skill.png",
    MYSTIC: "/icons/Mystic.png",
    COSMIC: "/icons/Cosmic.png",
    TECH: "/icons/Tech.png",
    MUTANT: "/icons/Mutant.png",
};

export const CLASSES: ChampionClass[] = ["SCIENCE", "SKILL", "MYSTIC", "COSMIC", "TECH", "MUTANT"];
