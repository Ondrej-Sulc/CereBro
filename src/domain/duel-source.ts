import type { DuelSource } from "@prisma/client";

export const DUEL_SOURCE_LABELS = {
  CEREBRO: "CereBro",
  USER_SUGGESTION: "User",
  GUIA_MTC: "GuiaMTC",
  COCPIT: "CoCPit",
  MCOCHUB: "MCOCHUB",
} satisfies Record<DuelSource, string>;
