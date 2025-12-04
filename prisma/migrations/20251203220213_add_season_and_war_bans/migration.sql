-- CreateTable
CREATE TABLE "SeasonBan" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "minTier" INTEGER,
    "maxTier" INTEGER,
    "championId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarBan" (
    "id" TEXT NOT NULL,
    "warId" TEXT NOT NULL,
    "championId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonBan_season_minTier_maxTier_championId_key" ON "SeasonBan"("season", "minTier", "maxTier", "championId");

-- CreateIndex
CREATE INDEX "WarBan_warId_idx" ON "WarBan"("warId");

-- CreateIndex
CREATE INDEX "WarBan_championId_idx" ON "WarBan"("championId");

-- AddForeignKey
ALTER TABLE "SeasonBan" ADD CONSTRAINT "SeasonBan_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarBan" ADD CONSTRAINT "WarBan_warId_fkey" FOREIGN KEY ("warId") REFERENCES "War"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarBan" ADD CONSTRAINT "WarBan_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
