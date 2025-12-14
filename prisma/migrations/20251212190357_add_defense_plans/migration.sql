-- CreateTable
CREATE TABLE "WarDefensePlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mapType" "WarMapType" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "allianceId" TEXT NOT NULL,
    "tacticId" TEXT,

    CONSTRAINT "WarDefensePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarDefensePlacement" (
    "id" TEXT NOT NULL,
    "nodeId" INTEGER NOT NULL,
    "defenderId" INTEGER,
    "playerId" TEXT,
    "planId" TEXT NOT NULL,

    CONSTRAINT "WarDefensePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WarDefensePlan_allianceId_idx" ON "WarDefensePlan"("allianceId");

-- CreateIndex
CREATE INDEX "WarDefensePlacement_planId_idx" ON "WarDefensePlacement"("planId");

-- CreateIndex
CREATE INDEX "WarDefensePlacement_playerId_idx" ON "WarDefensePlacement"("playerId");

-- CreateIndex
CREATE INDEX "WarDefensePlacement_defenderId_idx" ON "WarDefensePlacement"("defenderId");

-- CreateIndex
CREATE UNIQUE INDEX "WarDefensePlacement_planId_nodeId_key" ON "WarDefensePlacement"("planId", "nodeId");

-- AddForeignKey
ALTER TABLE "WarDefensePlan" ADD CONSTRAINT "WarDefensePlan_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarDefensePlan" ADD CONSTRAINT "WarDefensePlan_tacticId_fkey" FOREIGN KEY ("tacticId") REFERENCES "WarTactic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarDefensePlacement" ADD CONSTRAINT "WarDefensePlacement_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "WarNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarDefensePlacement" ADD CONSTRAINT "WarDefensePlacement_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarDefensePlacement" ADD CONSTRAINT "WarDefensePlacement_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarDefensePlacement" ADD CONSTRAINT "WarDefensePlacement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WarDefensePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
