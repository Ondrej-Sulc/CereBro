/*
  Warnings:

  - You are about to drop the column `prestige` on the `Champion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Champion" DROP COLUMN "prestige";

-- CreateTable
CREATE TABLE "ChampionPrestige" (
    "id" SERIAL NOT NULL,
    "championId" INTEGER NOT NULL,
    "rarity" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "sig" INTEGER NOT NULL,
    "prestige" INTEGER NOT NULL,

    CONSTRAINT "ChampionPrestige_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChampionPrestige_championId_idx" ON "ChampionPrestige"("championId");

-- CreateIndex
CREATE UNIQUE INDEX "ChampionPrestige_championId_rarity_rank_sig_key" ON "ChampionPrestige"("championId", "rarity", "rank", "sig");

-- AddForeignKey
ALTER TABLE "ChampionPrestige" ADD CONSTRAINT "ChampionPrestige_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
