-- AlterTable
ALTER TABLE "Champion" ADD COLUMN "gameId" TEXT;

-- CreateTable
CREATE TABLE "ChampionStats" (
    "id" SERIAL NOT NULL,
    "championId" INTEGER NOT NULL,
    "tierId" TEXT NOT NULL,
    "rarity" INTEGER,
    "rarityLabel" TEXT,
    "rank" INTEGER NOT NULL,
    "level" INTEGER,
    "challengeRating" INTEGER NOT NULL,
    "health" INTEGER,
    "attack" INTEGER,
    "healthRating" INTEGER,
    "attackRating" INTEGER,
    "prestige" INTEGER,
    "armorRating" INTEGER,
    "armorPenetration" INTEGER,
    "criticalRating" INTEGER,
    "criticalResistance" INTEGER,
    "criticalDamageRating" INTEGER,
    "blockProficiency" INTEGER,
    "blockPenetration" INTEGER,
    "specialDamageMultiplier" DOUBLE PRECISION,
    "energyResistance" INTEGER,
    "physicalResistance" INTEGER,
    "baseAbilityIds" TEXT[],
    "sigAbilityIds" TEXT[],

    CONSTRAINT "ChampionStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Champion_gameId_key" ON "Champion"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "ChampionStats_tierId_rank_key" ON "ChampionStats"("tierId", "rank");

-- CreateIndex
CREATE INDEX "ChampionStats_championId_idx" ON "ChampionStats"("championId");

-- CreateIndex
CREATE INDEX "ChampionStats_rarity_rank_idx" ON "ChampionStats"("rarity", "rank");

-- CreateIndex
CREATE INDEX "ChampionStats_challengeRating_idx" ON "ChampionStats"("challengeRating");

-- AddForeignKey
ALTER TABLE "ChampionStats" ADD CONSTRAINT "ChampionStats_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
