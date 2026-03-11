-- AlterTable
ALTER TABLE "BotUser" ADD COLUMN "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
