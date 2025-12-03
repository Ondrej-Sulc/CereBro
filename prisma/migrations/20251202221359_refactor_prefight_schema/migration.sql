-- CreateTable
CREATE TABLE "FightPrefight" (
    "id" TEXT NOT NULL,
    "warFightId" TEXT NOT NULL,
    "championId" INTEGER NOT NULL,
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FightPrefight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FightPrefight_warFightId_idx" ON "FightPrefight"("warFightId");

-- CreateIndex
CREATE INDEX "FightPrefight_championId_idx" ON "FightPrefight"("championId");

-- CreateIndex
CREATE INDEX "FightPrefight_playerId_idx" ON "FightPrefight"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "FightPrefight_warFightId_championId_key" ON "FightPrefight"("warFightId", "championId");

-- AddForeignKey
ALTER TABLE "FightPrefight" ADD CONSTRAINT "FightPrefight_warFightId_fkey" FOREIGN KEY ("warFightId") REFERENCES "WarFight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FightPrefight" ADD CONSTRAINT "FightPrefight_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FightPrefight" ADD CONSTRAINT "FightPrefight_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DATA MIGRATION
-- Note: In Prisma implicit many-to-many, A is usually the first model alphabetically (Champion) and B is the second (WarFight).
-- Champion.id is Int (A), WarFight.id is String (B).
INSERT INTO "FightPrefight" ("id", "warFightId", "championId", "playerId", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(), 
  "B", -- WarFightId (String)
  "A", -- ChampionId (Int)
  NULL, -- Player is nullable, keeping it null for migrated data
  CURRENT_TIMESTAMP, 
  CURRENT_TIMESTAMP
FROM "_PrefightChampions";

-- DropForeignKey
ALTER TABLE "_PrefightChampions" DROP CONSTRAINT "_PrefightChampions_A_fkey";

-- DropForeignKey
ALTER TABLE "_PrefightChampions" DROP CONSTRAINT "_PrefightChampions_B_fkey";

-- DropTable
DROP TABLE "_PrefightChampions";
