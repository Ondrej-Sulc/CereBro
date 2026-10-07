-- CreateEnum
CREATE TYPE "GameSynergyRole" AS ENUM ('OWNER', 'REQUIRED');

-- CreateTable
CREATE TABLE "GameSynergy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionTemplate" TEXT NOT NULL,
    "descriptionValue" DOUBLE PRECISION NOT NULL,
    "descriptionArgument" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "unique" BOOLEAN NOT NULL,
    "requiredHeroGroups" BOOLEAN NOT NULL,
    "targetTags" TEXT[],
    "effectIds" TEXT[],
    "sourceHash" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSynergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSynergyMember" (
    "synergyId" TEXT NOT NULL,
    "championId" INTEGER NOT NULL,
    "role" "GameSynergyRole" NOT NULL,
    "tierId" TEXT NOT NULL,
    "rarity" INTEGER NOT NULL,

    CONSTRAINT "GameSynergyMember_pkey" PRIMARY KEY ("synergyId","role","tierId")
);

-- CreateIndex
CREATE INDEX "GameSynergyMember_championId_role_rarity_idx" ON "GameSynergyMember"("championId", "role", "rarity");

-- AddForeignKey
ALTER TABLE "GameSynergyMember" ADD CONSTRAINT "GameSynergyMember_synergyId_fkey" FOREIGN KEY ("synergyId") REFERENCES "GameSynergy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSynergyMember" ADD CONSTRAINT "GameSynergyMember_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
