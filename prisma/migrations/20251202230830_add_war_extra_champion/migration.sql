-- CreateTable
CREATE TABLE "WarExtraChampion" (
    "id" TEXT NOT NULL,
    "warId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "championId" INTEGER NOT NULL,
    "battlegroup" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarExtraChampion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WarExtraChampion_warId_idx" ON "WarExtraChampion"("warId");

-- CreateIndex
CREATE INDEX "WarExtraChampion_playerId_idx" ON "WarExtraChampion"("playerId");

-- AddForeignKey
ALTER TABLE "WarExtraChampion" ADD CONSTRAINT "WarExtraChampion_warId_fkey" FOREIGN KEY ("warId") REFERENCES "War"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarExtraChampion" ADD CONSTRAINT "WarExtraChampion_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarExtraChampion" ADD CONSTRAINT "WarExtraChampion_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
