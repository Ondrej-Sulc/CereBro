import type { ChampionClass } from "@prisma/client";

export const CLASS_ICONS: Record<ChampionClass, string> = {
    SCIENCE: "/assets/icons/Science.png",
    SKILL: "/assets/icons/Skill.png",
    MYSTIC: "/assets/icons/Mystic.png",
    COSMIC: "/assets/icons/Cosmic.png",
    TECH: "/assets/icons/Tech.png",
    MUTANT: "/assets/icons/Mutant.png",
    SUPERIOR: "/assets/icons/superior.png",
};

export const CLASSES: ChampionClass[] = ["SCIENCE", "SKILL", "MYSTIC", "COSMIC", "TECH", "MUTANT"];
