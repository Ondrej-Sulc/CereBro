-- CreateEnum
CREATE TYPE "EncounterDifficulty" AS ENUM ('EASY', 'NORMAL', 'HARD');

-- AlterTable
ALTER TABLE "QuestEncounter" ADD COLUMN "difficulty" "EncounterDifficulty" NOT NULL DEFAULT 'NORMAL';
