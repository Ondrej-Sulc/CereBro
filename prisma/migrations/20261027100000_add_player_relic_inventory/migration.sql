CREATE TABLE "PlayerRelic" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "relicId" TEXT NOT NULL,
  "sourceRarityId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL CHECK ("rank" >= 1),
  "sigLevel" INTEGER NOT NULL DEFAULT 0 CHECK ("sigLevel" >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerRelic_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlayerRelic_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlayerRelic_relicId_sourceRarityId_fkey" FOREIGN KEY ("relicId", "sourceRarityId") REFERENCES "GameRelicRarity"("relicId", "sourceRarityId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerRelic_playerId_relicId_sourceRarityId_key" ON "PlayerRelic"("playerId", "relicId", "sourceRarityId");
