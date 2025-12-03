-- CreateTable
CREATE TABLE "WarTactic" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "minTier" INTEGER,
    "maxTier" INTEGER,
    "attackTag" TEXT,
    "defenseTag" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarTactic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarTactic_season_minTier_maxTier_key" ON "WarTactic"("season", "minTier", "maxTier");
