CREATE TABLE "GameRelicPrestige" (
    "relicId" TEXT NOT NULL,
    "sourceRarityId" TEXT NOT NULL,
    "sourceDefinitionHash" TEXT NOT NULL,
    "gameAssemblyHash" TEXT NOT NULL,
    "captureHash" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "ranks" JSONB NOT NULL,
    CONSTRAINT "GameRelicPrestige_pkey" PRIMARY KEY ("relicId", "sourceRarityId"),
    CONSTRAINT "GameRelicPrestige_rarity_fkey" FOREIGN KEY ("relicId", "sourceRarityId")
      REFERENCES "GameRelicRarity"("relicId", "sourceRarityId") ON DELETE CASCADE ON UPDATE CASCADE
);
