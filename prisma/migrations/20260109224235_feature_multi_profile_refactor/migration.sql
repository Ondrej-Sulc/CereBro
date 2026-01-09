-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "botUserId" TEXT;

-- CreateTable
CREATE TABLE "BotUser" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "isBotAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activeProfileId" TEXT,

    CONSTRAINT "BotUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotUser_discordId_key" ON "BotUser"("discordId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "BotUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
