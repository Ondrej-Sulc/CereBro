-- AlterEnum
ALTER TYPE "BotJobType" ADD VALUE 'NOTIFY_DEATH_VIDEO';

-- AlterTable
ALTER TABLE "Alliance" ADD COLUMN     "deathChannelId" TEXT;
