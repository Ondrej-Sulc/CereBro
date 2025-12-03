-- CreateTable
CREATE TABLE "NodeModifier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "NodeModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarNodeAllocation" (
    "id" TEXT NOT NULL,
    "warNodeId" INTEGER NOT NULL,
    "nodeModifierId" TEXT NOT NULL,
    "minTier" INTEGER,
    "maxTier" INTEGER,
    "season" INTEGER,

    CONSTRAINT "WarNodeAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NodeModifier_name_description_key" ON "NodeModifier"("name", "description");

-- CreateIndex
CREATE INDEX "WarNodeAllocation_warNodeId_idx" ON "WarNodeAllocation"("warNodeId");

-- CreateIndex
CREATE INDEX "WarNodeAllocation_nodeModifierId_idx" ON "WarNodeAllocation"("nodeModifierId");

-- AddForeignKey
ALTER TABLE "WarNodeAllocation" ADD CONSTRAINT "WarNodeAllocation_warNodeId_fkey" FOREIGN KEY ("warNodeId") REFERENCES "WarNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarNodeAllocation" ADD CONSTRAINT "WarNodeAllocation_nodeModifierId_fkey" FOREIGN KEY ("nodeModifierId") REFERENCES "NodeModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
