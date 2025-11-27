/*
  Warnings:

  - The `death` column on the `WarFight` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[warId,battlegroup,nodeId]` on the table `WarFight` will be added. If there are existing duplicate values, this will fail.
  - Made the column `battlegroup` on table `WarFight` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "WarStatus" AS ENUM ('PLANNING', 'FINISHED');

-- DropForeignKey
ALTER TABLE "WarFight" DROP CONSTRAINT "WarFight_attackerId_fkey";

-- DropForeignKey
ALTER TABLE "WarFight" DROP CONSTRAINT "WarFight_defenderId_fkey";

-- DropForeignKey
ALTER TABLE "WarFight" DROP CONSTRAINT "WarFight_playerId_fkey";

-- DropIndex
DROP INDEX "WarFight_warId_playerId_nodeId_key";

-- AlterTable
ALTER TABLE "War" ADD COLUMN     "status" "WarStatus" NOT NULL DEFAULT 'PLANNING';

-- AlterTable
ALTER TABLE "WarFight" DROP COLUMN "death",
ADD COLUMN     "death" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "attackerId" DROP NOT NULL,
ALTER COLUMN "defenderId" DROP NOT NULL,
ALTER COLUMN "playerId" DROP NOT NULL,
ALTER COLUMN "battlegroup" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "WarFight_warId_battlegroup_nodeId_key" ON "WarFight"("warId", "battlegroup", "nodeId");

-- AddForeignKey
ALTER TABLE "WarFight" ADD CONSTRAINT "WarFight_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarFight" ADD CONSTRAINT "WarFight_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarFight" ADD CONSTRAINT "WarFight_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
