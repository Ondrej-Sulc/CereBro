-- CreateEnum
CREATE TYPE "BotJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BotJobType" AS ENUM ('NOTIFY_WAR_VIDEO', 'DISTRIBUTE_WAR_PLAN');

-- CreateTable
CREATE TABLE "BotJob" (
    "id" TEXT NOT NULL,
    "type" "BotJobType" NOT NULL,
    "status" "BotJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotJob_pkey" PRIMARY KEY ("id")
);
