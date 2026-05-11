-- CreateTable
CREATE TABLE "RosterUploadEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "visionRequestCount" INTEGER NOT NULL DEFAULT 0,
    "processedChampionCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "errorMessages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "discordUserId" TEXT,
    "actorPlayerId" TEXT,
    "targetPlayerId" TEXT,
    "actorBotUserId" TEXT,
    "allianceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterUploadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterUploadEvent_createdAt_idx" ON "RosterUploadEvent"("createdAt");

-- CreateIndex
CREATE INDEX "RosterUploadEvent_source_mode_createdAt_idx" ON "RosterUploadEvent"("source", "mode", "createdAt");

-- CreateIndex
CREATE INDEX "RosterUploadEvent_status_createdAt_idx" ON "RosterUploadEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RosterUploadEvent_actorPlayerId_createdAt_idx" ON "RosterUploadEvent"("actorPlayerId", "createdAt");

-- CreateIndex
CREATE INDEX "RosterUploadEvent_targetPlayerId_createdAt_idx" ON "RosterUploadEvent"("targetPlayerId", "createdAt");

-- CreateIndex
CREATE INDEX "RosterUploadEvent_actorBotUserId_createdAt_idx" ON "RosterUploadEvent"("actorBotUserId", "createdAt");

-- CreateIndex
CREATE INDEX "RosterUploadEvent_allianceId_createdAt_idx" ON "RosterUploadEvent"("allianceId", "createdAt");

-- CreateIndex
CREATE INDEX "RosterUploadEvent_discordUserId_createdAt_idx" ON "RosterUploadEvent"("discordUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "RosterUploadEvent" ADD CONSTRAINT "RosterUploadEvent_actorPlayerId_fkey" FOREIGN KEY ("actorPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterUploadEvent" ADD CONSTRAINT "RosterUploadEvent_targetPlayerId_fkey" FOREIGN KEY ("targetPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterUploadEvent" ADD CONSTRAINT "RosterUploadEvent_actorBotUserId_fkey" FOREIGN KEY ("actorBotUserId") REFERENCES "BotUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterUploadEvent" ADD CONSTRAINT "RosterUploadEvent_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
