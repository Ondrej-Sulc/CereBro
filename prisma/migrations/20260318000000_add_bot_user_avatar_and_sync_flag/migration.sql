-- AlterTable
ALTER TABLE "BotUser" ADD COLUMN "avatar" TEXT;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "useDiscordAvatar" BOOLEAN NOT NULL DEFAULT true;
